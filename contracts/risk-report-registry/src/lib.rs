//! Domain validation for the Casper Sentinel risk report registry contract.
//!
//! The MVP contract phase will bind these primitives to Casper entry points. Keeping validation
//! pure here lets us test report rules locally before wiring chain-specific runtime code.

/// Autonomous security decision recorded with a risk report.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Decision {
    Approve,
    Warn,
    Block,
}

/// Compact risk report attestation intended for Casper Testnet storage.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskReport<'a> {
    pub wallet_address: &'a str,
    pub transaction_hash: Option<&'a str>,
    pub timestamp: u64,
    pub risk_score: u8,
    pub decision: Decision,
    pub explanation_hash: &'a str,
    pub metadata_hash: &'a str,
}

/// Validation errors rejected before a report is stored on-chain.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReportValidationError {
    EmptyWalletAddress,
    EmptyExplanationHash,
    EmptyMetadataHash,
    EmptyTransactionHash,
    ZeroTimestamp,
}

/// Validates a report attestation before contract storage.
pub fn validate_report(report: &RiskReport<'_>) -> Result<(), ReportValidationError> {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_report() -> RiskReport<'static> {
        RiskReport {
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
        assert_eq!(validate_report(&report), Err(ReportValidationError::ZeroTimestamp));
    }
}
