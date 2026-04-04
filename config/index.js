/*
  Configuration file for the application. It loads environment variables and provides default values if they are not set.
*/
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://angelynchua_db_user:nINzn9KYDB60vpwH@angelynchua.ltaqo8r.mongodb.net/archers_forum?appName=angelynchua';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'archers_forum';
const MONGO_DNS_SERVERS = process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1';

module.exports = {
  PORT,
  MONGO_URI,
  MONGO_DB_NAME,
  MONGO_DNS_SERVERS,
};