const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

const registerWithSimpleWebAuthn = async (email) => {
    var passkeyError = document.getElementById('passkey_error');

    const resp = await fetch('/api/generate-registration-options', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
        }),
    });
    const responseData = await resp.json();

    if (responseData && responseData.challenge) {
        let attResp;
        try {
            attResp = await startRegistration({ optionsJSON: responseData });
        } catch (error) {
            if (error.name === 'InvalidStateError') {
                passkeyError.style.display = 'block';
                passkeyError.innerText = 'Error: Authenticator was probably already registered by user';
            } else {
                passkeyError.style.display = 'block';
                passkeyError.innerText = error;
            }
            throw error;
        }

        const verificationResp = await fetch('/api/verify-registration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ passkey_info: attResp, email: email }),
        });
        const verificationJSON = await verificationResp.json();
        if (verificationJSON && verificationJSON.verified) {
            passkeyError.style.display = 'block';
            passkeyError.innerText = 'Success!';
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            passkeyError.style.display = 'block';
            passkeyError.innerText = `Oh no, something went wrong! Response: <pre>${JSON.stringify(
                verificationJSON,
            )}</pre>`;
        }
    }
}

const authenticateWithSimpleWebAuthn = async () => {
    const email = document.getElementById("login-email").value;
    var passkeyError = document.getElementById('passkey_error');

    const resp = await fetch('/api/generate-authentication-options', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
        }),
    });

    try {
        const opts = await resp.json();
        asseResp = await startAuthentication(opts);
    } catch (error) {
        passkeyError.style.display = 'block';
        passkeyError.innerText = error;
        throw new Error(error);
    }

    const verificationResp = await fetch('/api/verify-authentication', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passkey_info: asseResp, email: email }),
    });
    const verificationJSON = await verificationResp.json();
    if (verificationJSON && verificationJSON.verified) {
        passkeyError.style.display = 'block';
        passkeyError.innerText = 'Success!';
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    } else {
        passkeyError.style.display = 'block';
        passkeyError.innerText = `Oh no, something went wrong! Response: <pre>${JSON.stringify(
            verificationJSON,
        )}</pre>`;
    }
}
