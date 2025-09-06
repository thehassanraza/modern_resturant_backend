async function isValidEmail(email) {
    const result = {
        isValid: false,
        isVerified: false,
        errors: [],
        warnings: []
    };

    try {
        // Basic email format validation
        if (!email || typeof email !== 'string') {
            result.errors.push("Email is required.");
            return result;
        }

        const trimmedEmail = email.trim().toLowerCase();

        // Enhanced email regex pattern
        const emailRegex =
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!emailRegex.test(trimmedEmail)) {
            result.errors.push("Invalid email format.");
            return result;
        }

        const [_, domain] = trimmedEmail.split("@");

        // Check for suspicious patterns
        if (
            trimmedEmail.includes("..") ||
            trimmedEmail.startsWith(".") ||
            trimmedEmail.endsWith(".")
        ) {
            result.errors.push(
                "Invalid email format - consecutive dots or leading/trailing dots."
            );
            return result;
        }

        // Common domain typos
        const commonTypos = {
            "gmail.com": ["gmial.com", "gmail.co", "gmail.con", "gmai.com"],
            "yahoo.com": ["yaho.com", "yahoo.co", "yahoo.con"],
            "hotmail.com": ["hotmial.com", "hotmail.co", "hotmail.con"],
            "outlook.com": ["outlok.com", "outlook.co", "outlook.con"]
        };

        for (const [correctDomain, typos] of Object.entries(commonTypos)) {
            if (typos.includes(domain)) {
                result.warnings.push(
                    `Did you mean ${trimmedEmail.replace(domain, correctDomain)}?`
                );
            }
        }

        // Public free providers (reject if business-only requirement)
        const publicProviders = [
            "gmail.com",
            "yahoo.com",
            "hotmail.com",
            "outlook.com",
            "live.com",
            "aol.com",
            "icloud.com",
            "protonmail.com"
        ];
        if (publicProviders.includes(domain)) {
            result.errors.push(
                "Public email providers are not allowed. Please use a business or custom domain email."
            );
            return result;
        }

        // Disposable / temporary email providers
        const tempProviders = new Set([
            "yopmail.com", "yopmail.net", "yopmail.org", "yopmail.fr",
            "10minutemail.com", "tempmail.org", "guerrillamail.com", "mailinator.com",
            "throwaway.email", "temp-mail.org", "getnada.com", "maildrop.cc",
            "guerrillamail.biz", "sharklasers.com", "grr.la", "guerrillamail.info",
            "guerrillamail.de", "guerrillamail.net", "guerrillamail.org",
            "guerrillamailblock.com", "pokemail.net", "spam4.me", "bccto.me",
            "chacuo.net", "dispostable.com", "mailnesia.com",
            "trashmail.com", "spamgourmet.com", "mailcatch.com", "spam.la",
            "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com",
            "letthemeatspam.com", "mailin8r.com", "notmailinator.com",
            "reallymymail.com", "safetymail.info", "sogetthis.com",
            "spamhereplease.com", "superrito.com", "thisisnotmyrealemail.com",
            "tradermail.info", "veryrealemail.com", "wegwerfadresse.de"
        ]);

        if (tempProviders.has(domain)) {
            result.errors.push(
                "Temporary or disposable email providers are not allowed. Please use a permanent email address."
            );
            return result;
        }

        // Passed all checks
        result.isValid = true;
        result.isVerified = true;
        result.warnings.push("Email passed validation.");

    } catch (error) {
        result.errors.push("Email validation failed: " + error.message);
    }

    return result;
}

module.exports = {
    isValidEmail
};
