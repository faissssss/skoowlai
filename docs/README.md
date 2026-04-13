# Documentation

This directory contains all project documentation organized by category.

---

## 📁 Directory Structure

### `/security/` - Security Documentation
Comprehensive security hardening documentation, analysis, and verification reports.

- **[SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md)** ⭐ (Root) - Pre-push security checklist
- **[SECRETS_ROTATION.md](security/SECRETS_ROTATION.md)** - Secret rotation guide
- **[SECURITY_LAYERS_ANALYSIS.md](security/SECURITY_LAYERS_ANALYSIS.md)** - Analysis of security layers
- **[SECURITY_FIX_VERIFICATION.md](security/SECURITY_FIX_VERIFICATION.md)** - File size limit fix verification
- **[SECURITY_PRE_PUSH_VERIFICATION.md](security/SECURITY_PRE_PUSH_VERIFICATION.md)** - Complete pre-push verification report
- **[USER_ERROR_HANDLING_ANALYSIS.md](security/USER_ERROR_HANDLING_ANALYSIS.md)** - User error handling and UI warnings

### `/troubleshooting/` - Troubleshooting Guides
Guides for debugging and resolving common issues.

- **[TROUBLESHOOTING_FAILED_TO_FETCH.md](troubleshooting/TROUBLESHOOTING_FAILED_TO_FETCH.md)** - Failed to fetch errors
- **[test-rewrite-endpoint.md](troubleshooting/test-rewrite-endpoint.md)** - Rewrite endpoint testing

### `/fixes/` - Historical Fix Documentation
Documentation of past issues and their resolutions (for reference).

- **[FIXES_APPLIED.md](fixes/FIXES_APPLIED.md)** - Applied fixes log
- **[ROOT_CAUSE_AND_FIX.md](fixes/ROOT_CAUSE_AND_FIX.md)** - Root cause analysis
- **[STREAM_CONSUMPTION_FIX.md](fixes/STREAM_CONSUMPTION_FIX.md)** - Stream consumption fix

### `/` - Other Documentation
- **[ONEDRIVE_FIX.md](ONEDRIVE_FIX.md)** - OneDrive integration fix

---

## 🔒 Security Documentation Quick Links

### Before Every Push
1. Read: [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md) (in root)
2. Run: `npm run test:security`
3. Verify: No secrets in staged changes

### Security Analysis
- **Layers**: [SECURITY_LAYERS_ANALYSIS.md](security/SECURITY_LAYERS_ANALYSIS.md)
- **Verification**: [SECURITY_PRE_PUSH_VERIFICATION.md](security/SECURITY_PRE_PUSH_VERIFICATION.md)
- **Error Handling**: [USER_ERROR_HANDLING_ANALYSIS.md](security/USER_ERROR_HANDLING_ANALYSIS.md)

### Secret Management
- **Rotation Guide**: [SECRETS_ROTATION.md](security/SECRETS_ROTATION.md)
- **When to Rotate**: Before going fully public, after breach, quarterly maintenance

---

## 📚 Spec Documentation

Spec files are located in `.kiro/specs/` directory:

- **Security Hardening Spec**: `.kiro/specs/security-hardening/`
  - `requirements.md` - Security requirements
  - `design.md` - Security design
  - `tasks.md` - Implementation tasks

---

## 🚀 Quick Start

### For Developers
1. Read [README.md](../README.md) in root
2. Review [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md)
3. Set up `.env` file (see `.env.example`)

### For Security Review
1. Start with [SECURITY_PRE_PUSH_VERIFICATION.md](security/SECURITY_PRE_PUSH_VERIFICATION.md)
2. Review [SECURITY_LAYERS_ANALYSIS.md](security/SECURITY_LAYERS_ANALYSIS.md)
3. Check [SECRETS_ROTATION.md](security/SECRETS_ROTATION.md) for secret status

### For Troubleshooting
1. Check [troubleshooting/](troubleshooting/) directory
2. Review [fixes/](fixes/) for similar past issues
3. Search GitHub issues

---

## 📝 Document Maintenance

### Adding New Documentation
- **Security docs** → `docs/security/`
- **Troubleshooting guides** → `docs/troubleshooting/`
- **Fix documentation** → `docs/fixes/`
- **General docs** → `docs/`

### Archiving Old Documentation
- Move outdated docs to `docs/archive/` (create if needed)
- Update this README to reflect changes
- Keep a changelog in archived docs

---

**Last Updated:** April 13, 2026
