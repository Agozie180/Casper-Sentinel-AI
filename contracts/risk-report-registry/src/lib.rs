//! Contract-core model for the Casper Sentinel risk report registry.
//!
//! The Wasm wrapper binds these primitives to Casper entry points named `record_report`, `get_report`, and wallet-index lookup.
//! Keeping this core pure lets the team verify storage, validation, and event semantics locally while the same crate
//! can still build the deployable chain wrapper.

#![cfg_attr(target_arch = "wasm32", no_std)]

extern crate alloc;

use alloc::{
    collections::BTreeMap,
    string::{String, ToString},
    vec::Vec,
};

#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

/// Autonomous security decision recorded with a risk report.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Decision {
    Approve,
    Warn,
    Block,
}

impl Decision {
    /// Returns the stable wire representation stored in report attestations.
    pub fn as_str(self) -> &'static str {
        match self {
            Decision::Approve => "APPROVE",
            Decision::Warn => "WARN",
            Decision::Block => "BLOCK",
        }
    }
}

/// Compact risk report attestation intended for Casper Testnet storage.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskReport<'a> {
    pub report_id: &'a str,
    pub wallet_address: &'a str,
    pub transaction_hash: Option<&'a str>,
    pub timestamp: u64,
    pub risk_score: u8,
    pub decision: Decision,
    pub explanation_hash: &'a str,
    pub metadata_hash: &'a str,
}

/// Owned representation stored by the registry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StoredRiskReport {
    pub report_id: String,
    pub wallet_address: String,
    pub transaction_hash: Option<String>,
    pub timestamp: u64,
    pub risk_score: u8,
    pub decision: Decision,
    pub explanation_hash: String,
    pub metadata_hash: String,
}

impl From<&RiskReport<'_>> for StoredRiskReport {
    fn from(report: &RiskReport<'_>) -> Self {
        Self {
            report_id: report.report_id.to_string(),
            wallet_address: report.wallet_address.to_string(),
            transaction_hash: report.transaction_hash.map(str::to_string),
            timestamp: report.timestamp,
            risk_score: report.risk_score,
            decision: report.decision,
            explanation_hash: report.explanation_hash.to_string(),
            metadata_hash: report.metadata_hash.to_string(),
        }
    }
}

/// Event emitted when a report attestation is recorded.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReportRecordedEvent {
    pub report_id: String,
    pub wallet_address: String,
    pub risk_score: u8,
    pub decision: Decision,
    pub timestamp: u64,
    pub metadata_hash: String,
}

impl ReportRecordedEvent {
    /// Returns the event name a Casper event wrapper should emit.
    pub fn event_name() -> &'static str {
        "ReportRecorded"
    }
}

/// Validation errors rejected before a report is stored on-chain.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReportValidationError {
    EmptyReportId,
    EmptyWalletAddress,
    EmptyExplanationHash,
    EmptyMetadataHash,
    EmptyTransactionHash,
    ZeroTimestamp,
    DuplicateReport,
}

/// In-memory contract core mirroring the report registry's on-chain state layout.
#[derive(Default, Debug)]
pub struct RiskReportRegistry {
    reports_by_id: BTreeMap<String, StoredRiskReport>,
    reports_by_wallet: BTreeMap<String, Vec<String>>,
    events: Vec<ReportRecordedEvent>,
}

impl RiskReportRegistry {
    /// Records a validated report and emits a `ReportRecorded` event.
    pub fn record_report(
        &mut self,
        report: RiskReport<'_>,
    ) -> Result<ReportRecordedEvent, ReportValidationError> {
        validate_report(&report)?;

        if self.reports_by_id.contains_key(report.report_id) {
            return Err(ReportValidationError::DuplicateReport);
        }

        let stored = StoredRiskReport::from(&report);
        self.reports_by_id
            .insert(stored.report_id.clone(), stored.clone());
        self.reports_by_wallet
            .entry(stored.wallet_address.clone())
            .or_default()
            .push(stored.report_id.clone());

        let event = ReportRecordedEvent {
            report_id: stored.report_id,
            wallet_address: stored.wallet_address,
            risk_score: stored.risk_score,
            decision: stored.decision,
            timestamp: stored.timestamp,
            metadata_hash: stored.metadata_hash,
        };
        self.events.push(event.clone());
        Ok(event)
    }

    /// Returns one report by id, matching the contract `get_report` entry point semantics.
    pub fn get_report(&self, report_id: &str) -> Option<&StoredRiskReport> {
        self.reports_by_id.get(report_id)
    }

    /// Returns all reports for a wallet in insertion order.
    pub fn get_reports_by_wallet(&self, wallet_address: &str) -> Vec<&StoredRiskReport> {
        self.reports_by_wallet
            .get(wallet_address)
            .into_iter()
            .flat_map(|ids| ids.iter())
            .filter_map(|report_id| self.reports_by_id.get(report_id))
            .collect()
    }

    /// Returns emitted events for test assertions and future Casper event binding.
    pub fn events(&self) -> &[ReportRecordedEvent] {
        &self.events
    }
}

/// Validates a report attestation before contract storage.
pub fn validate_report(report: &RiskReport<'_>) -> Result<(), ReportValidationError> {
    if report.report_id.trim().is_empty() {
        return Err(ReportValidationError::EmptyReportId);
    }

    if report.wallet_address.trim().is_empty() {
        return Err(ReportValidationError::EmptyWalletAddress);
    }

    if let Some(transaction_hash) = report.transaction_hash {
        if transaction_hash.trim().is_empty() {
            return Err(ReportValidationError::EmptyTransactionHash);
        }
    }

    if report.timestamp == 0 {
        return Err(ReportValidationError::ZeroTimestamp);
    }

    if report.explanation_hash.trim().is_empty() {
        return Err(ReportValidationError::EmptyExplanationHash);
    }

    if report.metadata_hash.trim().is_empty() {
        return Err(ReportValidationError::EmptyMetadataHash);
    }

    Ok(())
}

#[cfg(target_arch = "wasm32")]
mod casper_entry_points {
    use alloc::{
        boxed::Box,
        collections::BTreeMap,
        format,
        string::{String, ToString},
        vec,
    };

    use casper_contract::{
        contract_api::{runtime, storage},
        unwrap_or_revert::UnwrapOrRevert,
    };
    use casper_types::{
        addressable_entity::{
            EntityEntryPoint, EntryPointAccess, EntryPointPayment, EntryPointType, EntryPoints,
            Parameter,
        },
        CLType, CLValue, Key,
    };

    const CONTRACT_HASH_KEY: &str = "casper_sentinel_risk_report_registry";
    const CONTRACT_ACCESS_KEY: &str = "casper_sentinel_risk_report_registry_access";
    const REPORTS_DICTIONARY: &str = "reports_by_id";
    const WALLET_INDEX_DICTIONARY: &str = "reports_by_wallet";

    #[no_mangle]
    pub extern "C" fn record_report() {
        let report_id: String = runtime::get_named_arg("report_id");
        let wallet_address: String = runtime::get_named_arg("wallet_address");
        let transaction_hash: String = runtime::get_named_arg("transaction_hash");
        let timestamp: u64 = runtime::get_named_arg("timestamp");
        let risk_score: u8 = runtime::get_named_arg("risk_score");
        let decision: String = runtime::get_named_arg("decision");
        let explanation_hash: String = runtime::get_named_arg("explanation_hash");
        let metadata_hash: String = runtime::get_named_arg("metadata_hash");

        let encoded_report = format!(
            "wallet={};transaction={};timestamp={};risk={};decision={};explanation={};metadata={}",
            wallet_address,
            transaction_hash,
            timestamp,
            risk_score,
            decision,
            explanation_hash,
            metadata_hash,
        );
        storage::named_dictionary_put(REPORTS_DICTIONARY, &report_id, encoded_report);

        let existing_index =
            storage::named_dictionary_get::<String>(WALLET_INDEX_DICTIONARY, &wallet_address)
                .unwrap_or_revert()
                .unwrap_or_default();
        let next_index = if existing_index.is_empty() {
            report_id
        } else {
            format!("{},{}", existing_index, report_id)
        };
        storage::named_dictionary_put(WALLET_INDEX_DICTIONARY, &wallet_address, next_index);
    }

    #[no_mangle]
    pub extern "C" fn get_report() {
        let report_id: String = runtime::get_named_arg("report_id");
        let report = storage::named_dictionary_get::<String>(REPORTS_DICTIONARY, &report_id)
            .unwrap_or_revert();
        runtime::ret(CLValue::from_t(report).unwrap_or_revert());
    }

    #[no_mangle]
    pub extern "C" fn get_reports_by_wallet() {
        let wallet_address: String = runtime::get_named_arg("wallet_address");
        let report_ids =
            storage::named_dictionary_get::<String>(WALLET_INDEX_DICTIONARY, &wallet_address)
                .unwrap_or_revert();
        runtime::ret(CLValue::from_t(report_ids).unwrap_or_revert());
    }

    #[no_mangle]
    pub extern "C" fn call() {
        let mut named_keys = BTreeMap::new();
        let reports_uref = storage::new_dictionary(REPORTS_DICTIONARY).unwrap_or_revert();
        let wallet_index_uref = storage::new_dictionary(WALLET_INDEX_DICTIONARY).unwrap_or_revert();
        named_keys.insert(REPORTS_DICTIONARY.to_string(), Key::from(reports_uref));
        named_keys.insert(
            WALLET_INDEX_DICTIONARY.to_string(),
            Key::from(wallet_index_uref),
        );

        let mut entry_points = EntryPoints::new();
        entry_points.add_entry_point(EntityEntryPoint::new(
            "record_report",
            vec![
                Parameter::new("report_id", CLType::String),
                Parameter::new("wallet_address", CLType::String),
                Parameter::new("transaction_hash", CLType::String),
                Parameter::new("timestamp", CLType::U64),
                Parameter::new("risk_score", CLType::U8),
                Parameter::new("decision", CLType::String),
                Parameter::new("explanation_hash", CLType::String),
                Parameter::new("metadata_hash", CLType::String),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
            EntryPointPayment::Caller,
        ));
        entry_points.add_entry_point(EntityEntryPoint::new(
            "get_report",
            vec![Parameter::new("report_id", CLType::String)],
            CLType::Option(Box::new(CLType::String)),
            EntryPointAccess::Public,
            EntryPointType::Called,
            EntryPointPayment::Caller,
        ));
        entry_points.add_entry_point(EntityEntryPoint::new(
            "get_reports_by_wallet",
            vec![Parameter::new("wallet_address", CLType::String)],
            CLType::Option(Box::new(CLType::String)),
            EntryPointAccess::Public,
            EntryPointType::Called,
            EntryPointPayment::Caller,
        ));

        storage::new_contract(
            entry_points,
            Some(named_keys.into()),
            Some(CONTRACT_HASH_KEY.to_string()),
            Some(CONTRACT_ACCESS_KEY.to_string()),
            None,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_report() -> RiskReport<'static> {
        RiskReport {
            report_id: "report-001",
            wallet_address: "account-hash-sender",
            transaction_hash: Some("deploy-hash-example"),
            timestamp: 1_782_787_200,
            risk_score: 42,
            decision: Decision::Warn,
            explanation_hash: "hash-explanation",
            metadata_hash: "hash-metadata",
        }
    }

    #[test]
    fn accepts_valid_report() {
        assert_eq!(validate_report(&valid_report()), Ok(()));
    }

    #[test]
    fn rejects_empty_report_id() {
        let mut report = valid_report();
        report.report_id = " ";
        assert_eq!(
            validate_report(&report),
            Err(ReportValidationError::EmptyReportId)
        );
    }

    #[test]
    fn rejects_empty_wallet() {
        let mut report = valid_report();
        report.wallet_address = "";
        assert_eq!(
            validate_report(&report),
            Err(ReportValidationError::EmptyWalletAddress)
        );
    }

    #[test]
    fn rejects_empty_optional_transaction_hash() {
        let mut report = valid_report();
        report.transaction_hash = Some(" ");
        assert_eq!(
            validate_report(&report),
            Err(ReportValidationError::EmptyTransactionHash)
        );
    }

    #[test]
    fn rejects_zero_timestamp() {
        let mut report = valid_report();
        report.timestamp = 0;
        assert_eq!(
            validate_report(&report),
            Err(ReportValidationError::ZeroTimestamp)
        );
    }

    #[test]
    fn records_and_gets_reports() {
        let mut registry = RiskReportRegistry::default();
        let event = registry
            .record_report(valid_report())
            .expect("record report");

        assert_eq!(event.report_id, "report-001");
        assert_eq!(ReportRecordedEvent::event_name(), "ReportRecorded");
        assert_eq!(
            registry
                .get_report("report-001")
                .map(|report| report.risk_score),
            Some(42)
        );
        assert_eq!(registry.events(), &[event]);
    }

    #[test]
    fn indexes_reports_by_wallet() {
        let mut registry = RiskReportRegistry::default();
        let mut second = valid_report();
        second.report_id = "report-002";
        second.risk_score = 88;

        registry
            .record_report(valid_report())
            .expect("first report");
        registry.record_report(second).expect("second report");

        let reports = registry.get_reports_by_wallet("account-hash-sender");
        assert_eq!(reports.len(), 2);
        assert_eq!(reports[1].risk_score, 88);
    }

    #[test]
    fn rejects_duplicate_reports() {
        let mut registry = RiskReportRegistry::default();
        registry
            .record_report(valid_report())
            .expect("first report");

        assert_eq!(
            registry.record_report(valid_report()),
            Err(ReportValidationError::DuplicateReport)
        );
    }

    #[test]
    fn exposes_decision_wire_values() {
        assert_eq!(Decision::Approve.as_str(), "APPROVE");
        assert_eq!(Decision::Warn.as_str(), "WARN");
        assert_eq!(Decision::Block.as_str(), "BLOCK");
    }
}
