const bcrypt = require('bcrypt');

const password = 'mariadb';

const hashedPassword = bcrypt.hashSync(password, 10);

console.log(hashedPassword);