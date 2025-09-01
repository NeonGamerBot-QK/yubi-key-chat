
const PrismaClient = require('@prisma/client');

const prismaClient = new PrismaClient.PrismaClient();

module.exports = prismaClient;