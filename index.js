require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const prismaClient = require('./client');
const constData = require('./const.js');
// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth.js');
const settingsRoutes = require('./routes/settings.js');
const notFoundRoute = require('./routes/notFound.js');

const app = express();
const PORT = constData.WEBPORT;
const prisma = prismaClient;

async function main() {
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'front')));
    app.use(
        session({
            secret: 'secret123',
            saveUninitialized: true,
            resave: false,
            cookie: {
                maxAge: 86400000,
                httpOnly: true,
            },
        }),
    );
    app.use((req, res, next) => {
        res.locals.user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
        next();
    });

    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');

    app.use('/', indexRoutes);
    app.use('/', authRoutes);
    app.use('/', settingsRoutes);
    app.use(notFoundRoute);
    
    app.listen(PORT, () => {
        console.info(`Server started on port: ${PORT}`);
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
