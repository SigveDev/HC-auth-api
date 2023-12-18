const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();
const jwt = require('jsonwebtoken');
const sdk = require('node-appwrite');

dotenv.config();

app.use(cors());
app.use(express.json());

app.get('/jwt', (req, res) => {
    try {
        const jwt = req.header('jwt_token');
        
        let client = new sdk.Client();
        client
            .setEndpoint(process.env.PRODJECT_ENDPOINT)
            .setProject(process.env.PRODJECT_ID)
            .setJWT(jwt);

        let account = new sdk.Account(client);

        const promise = account.createJWT();

        promise.then(function (response) {
            res.status(200).json(response);
        }, function (error) {
            console.log(error);
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.get('/account', (req, res) => {
    try {
        const jwt_token = req.header('jwt_token');
        
        let client = new sdk.Client();
        client
            .setEndpoint(process.env.PRODJECT_ENDPOINT)
            .setProject(process.env.PRODJECT_ID)
            .setJWT(jwt_token);

        let account = new sdk.Account(client);

        let databases = new sdk.Databases(client);

        const promise = account.get();

        promise.then(function (response) {
            const configPromise = databases.getDocument(process.env.HC_AUTH_DB, process.env.CONFIG_ID, response['$id']);

            configPromise.then(function (configResponse) {
                const token = jwt.sign({
                    account: response,
                    config: configResponse
                }, process.env.JWT_SECRET, { expiresIn: '7d' });

                res.status(200).json({ 'account': response, 'config': configResponse, 'jwt': token });
            }, function (error) {
                console.log(error);
            });
        }, function (error) {
            console.log(error);
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.get('/auth', async (req, res) => {
    try {
        const HCjwt = req.header('jwt_token');
        const data = jwt.verify(HCjwt, process.env.JWT_SECRET);

        const timeCreated = data.iat;
        const currentTime = Math.floor(Date.now() / 1000);

        if(data) {
            if (currentTime - timeCreated > 3600) {
                const client = new sdk.Client();

                client
                    .setEndpoint(process.env.PRODJECT_ENDPOINT)
                    .setProject(process.env.PRODJECT_ID)
                    .setKey(process.env.API_KEY);

                const users = new sdk.Users(client);

                let databases = new sdk.Databases(client);

                const promise = await users.get(data.account['$id']);

                const configPromise = await databases.getDocument(process.env.HC_AUTH_DB, process.env.CONFIG_ID, data.account['$id']);

                const token = jwt.sign({
                    account: promise,
                    config: configPromise
                }, process.env.JWT_SECRET, { expiresIn: '7d' });

                res.status(200).json({ 'account': promise, 'config': configPromise, 'jwt': token });
            } else {
                res.status(200).json(data);
            }
        } else {
            res.status(401).send('Unauthorized');
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.get('/pfp', (req, res) => {
    try {
        const ReqJwt = req.header('jwt_token');
        const data = jwt.verify(ReqJwt, process.env.JWT_SECRET);
        
        let client = new sdk.Client();

        client
            .setEndpoint(process.env.PRODJECT_ENDPOINT)
            .setProject(process.env.PRODJECT_ID)
            .setKey(process.env.API_KEY);
        
        let users = new sdk.Users(client);

        let storage = new sdk.Storage(client);

        let databases = new sdk.Databases(client);

        const userCheck = users.get(data.account['$id']);

        userCheck.then(function (response) {
            const configPromise = databases.getDocument(process.env.HC_AUTH_DB, process.env.CONFIG_ID, response['$id']);

                configPromise.then(function (configResponse) {
                    const promise = storage.getFileView(process.env.PFP_BUCKET_ID, configResponse.pfp);

                    promise.then(function (response) {
                        res.set('Content-Type', 'image/png');
                        res.send(response);
                    }, function (error) {
                        console.log(error);
                        res.status(404).send('Image not found');
                    });
                }, function (error) {
                    console.log(error);
                    res.status(404).send('Config not found');
                });
        }, function (error) {
            console.log(error);
            res.status(404).send('User not found');
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.listen(process.env.PORT, () => {
    console.log('Using port: ' + process.env.PORT);
});

module.exports = app;