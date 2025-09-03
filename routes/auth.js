const express = require('express');
const router = express.Router();
const { generateRegistrationOptions,
    verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const prismaClient = require('../client.js');
const constData = require('../const.js');
const crypto = require('crypto');
var flash = require('connect-flash');

const prisma = prismaClient;

router.use(flash());

const getErrorMsg = (error) => {
    let errorMessage = "Failed to register";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return errorMessage;
}

const contextBuffer = (buffer) => Buffer.from(buffer, 'base64');

router.get('/login', (req, res) => {
    res.render('layout', { title: 'Login', view: `passkey-login`, error: req.flash('error'), message: req.flash('message') });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            req.flash('error', 'No user with that email exists');
            return res.redirect('/login');
        }
        else {
            res.cookie('user', JSON.stringify({ id: user.id, name: user.name }), { maxAge: 3600000 });
            return res.redirect('/');
        }
    } catch (error) {
        let errMsg = getErrorMsg(error);
        req.flash('error', errMsg);
        return res.redirect('/login');
    }
});

router.get('/passkey-login', async (req, res) => {
    res.render('layout', { title: 'passkey-login', view: `passkey-login` });
});

router.post('/passkey-login', async (req, res) => {

});

router.get('/register', (req, res) => {
    res.render('layout', { title: 'Register', view: `passkey-register`, error: req.flash('error') });
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            req.flash('error', 'Email is already registered. Please log in.');
            return res.redirect('/register');
        }
        else {
            await prisma.user.create({
                data: {
                    name,
                    email,
                    password: crypto.createHash("sha256").update(password).digest("hex"),
                },
            });
            res.cookie('register_email', JSON.stringify({ user_email: email }), { maxAge: 3600000 });
            return res.redirect('/passkey-register');
        }
    } catch (error) {
        let errMsg = getErrorMsg(error);
        req.flash('error', errMsg);
        return res.redirect('/register');
    }
});

router.get('/passkey-register', async (req, res) => {
    const user_email = req.cookies.register_email ? JSON.parse(req.cookies.register_email) : null;
    if (user_email && user_email.user_email) {
        res.render('layout', { title: 'passkey-register', view: `passkey-register`, user_email: user_email.user_email });
    }
    else {
        req.flash('message', 'Register successful. Please login.');
        return res.redirect('/login');
    }
});

router.post('/passkey-register', async (req, res) => {

});

router.get('/logout', (req, res) => {
    res.clearCookie('user');
    res.redirect('/');
});

const rpName = constData.RPName;
const rpID = constData.RPID;
const origin = `${constData.RPORIGINURL}:${constData.WEBPORT}`;
const expOrigin = `http://localhost`;

router.use(express.json());

router.post('/api/generate-registration-options', async (req, res) => {
    try {
        const { yubikeyOtp } = req.body;
        // const prismaUser = await prisma.user.findUnique({ login_yubikey: { yubikeyOtp } });
        // if (!prismaUser) {
        //     return res.status(400).send({ error: "No user with that email exists" });
        // }
        // else {
        const user = {
            // id: prismaUser.id,
            username: yubikeyOtp,
            // email: prismaUser.email,
            devices: [],
        };

        let opts = {
            rpName: rpName,
            rpID,
            userName: user.username,
            timeout: 60000,
            attestationType: 'none',
            excludeCredentials: user.devices.map((dev) => ({
                id: dev.credentialID,
                type: 'public-key',
                transports: dev.transports,
            })),
            authenticatorSelection: {
                residentKey: 'discouraged',
                userVerification: 'preferred',
            },
            supportedAlgorithmIDs: [-7, -257],
        }

        const options = await generateRegistrationOptions(opts);
        req.session.currentChallenge = options.challenge;
        req.session.webAuthnUserID = options.user.id;
        res.send(options);
        // }
    } catch (error) {
        console.error(error)
        res.status(400).send({ error: error.message });
    }
});

router.post('/api/verify-registration', async (req, res) => {
    const { passkey_info, email } = req.body;
    // const prismaUser = await prisma.user.findUnique({ where: { yubikeyOtp: email } });
    const user = {
        // id: prismaUser.id,
        username: email,
        // email: prismaUser.email,
        // devices: prismaUser.devices,
    };
    const expectedChallenge = req.session.currentChallenge;

    let verification;
    try {
        const opts = {
            response: passkey_info,
            expectedChallenge: `${expectedChallenge}`,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: false,
        };
        verification = await verifyRegistrationResponse(opts);
    } catch (error) {
        const _error = error;
        return res.status(400).send({ error: _error.message });
    }

    const { verified, registrationInfo } = verification;
    if (verified && registrationInfo) {
        const { credentialPublicKey, credentialID, counter } = registrationInfo;
        const existingDevice = user.devices.find((device) => device.credentialID === credentialID);

        const publicKeyToStore = contextBuffer(credentialPublicKey);

        if (!existingDevice) {
            const newDevice = {
                credentialPublicKey: publicKeyToStore.toString('base64'),
                credentialID,
                counter,
                transports: passkey_info.response.transports,
            };
            user.devices.push(newDevice);
        }

        //!Update user info
        await prisma.user.update({
            where: { id: user.id },
            data: {
                devices: user.devices
            },
        });

        //!Update passkey
        const webAuthnUserID = req.session.webAuthnUserID;

        await prisma.passKey.create({
            data: {
                passkey_id: credentialID,
                public_key: publicKeyToStore,
                user_id: user.id,
                webauthnUser_id: webAuthnUserID,
                counter: counter,
                device_type: registrationInfo.credentialDeviceType,
                back_up: registrationInfo.credentialBackedUp,
                devices: user.devices
            },
        });
    }
    req.session.currentChallenge = undefined;
    req.session.webAuthnUserID = undefined;

    res.cookie('user', JSON.stringify({ id: prismaUser.id, name: prismaUser.name }), { maxAge: 3600000 });
    res.status(200).send({ verified });
});

router.post('/api/generate-authentication-options', async (req, res) => {
    const { login_yubikey } = req.body;
    const prismaUser = await prisma.user.findUnique({ yubikeyOtp: { login_yubikey } });
    if (!prismaUser) {
        return res.status(400).send({ error: "No user with that yubikeyOtp exists" });
    }
    else {
        const user = {
            id: prismaUser.id,
            username: prismaUser.yubikeyOtp,
            devices: prismaUser.devices,
        };
        const opts = {
            timeout: 60000,
            allowCredentials: user.devices.map((dev) => ({
                id: dev.credentialID,
                type: 'public-key',
                transports: dev.transports,
            })),
            userVerification: 'preferred',
            rpID,
        };
        const options = await generateAuthenticationOptions(opts);
        req.session.currentChallenge = options.challenge;
        res.send(options);
    }
});

router.post('/api/verify-authentication', async (req, res) => {
    const { passkey_info, email } = req.body;
    const prismaUser = await prisma.user.findUnique({ where: { email } });
    const user = {
        id: prismaUser.id,
        username: prismaUser.name,
        email: prismaUser.email,
        devices: prismaUser.devices,
    };
    const expectedChallenge = req.session.currentChallenge;

    let dbAuthenticator;
    for (const dev of user.devices) {
        if (dev.credentialID === passkey_info.id) {
            const tempPublicKey = contextBuffer(dev.credentialPublicKey);
            dev.credentialPublicKey = new Uint8Array(tempPublicKey);
            dbAuthenticator = dev;
            break;
        }
    }
    if (!dbAuthenticator) {
        return res.status(400).send({
            error: 'Authenticator is not registered with this site',
        });
    }

    let verification;
    try {
        const opts = {
            response: passkey_info,
            expectedChallenge: `${expectedChallenge}`,
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator: dbAuthenticator,
            requireUserVerification: false,
        };

        verification = await verifyAuthenticationResponse(opts);
    } catch (error) {
        const _error = error;
        return res.status(400).send({ error: _error.message });
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
        dbAuthenticator.counter = authenticationInfo.newCounter;
    }
    req.session.currentChallenge = undefined;
    res.cookie('user', JSON.stringify({ id: prismaUser.id, name: prismaUser.name }), { maxAge: 3600000 });
    res.status(200).send({ verified });
});

module.exports = router;
