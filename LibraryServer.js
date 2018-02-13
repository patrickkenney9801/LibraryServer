const express = require('express');
const mysql = require('mysql');
var bodyParser = require('body-parser');
bodyParser.urlencoded = false;
var path = '/library/api';
var server_password = 'supersecretpassword12345';

// create connection
const db = mysql.createConnection({
    host                : 'localhost',
    user                : 'root',
    password            : '98011089',
    database            : 'library',
    multipleStatements  : true
});

// connect
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('MySql Connected...');
});

var app = express();

app.use(bodyParser.json());

var logger = (req, res, next) => {
    console.log('Logging...');
    next();
}

app.use(logger);

app.get('/', (req, res) => {
    res.send('Hello World!');
});



/***** USERS ******/



// Creates a new account
app.post(path + '/users/create', (req, res) => {
    console.log("Creating account...");
    var temp = req.body;
    // if the sender is not using the correct server password, send code 299 and exit
    if (temp.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // create new account template, user_key is added later
    var newaccount = {
        first_name          : temp.first_name,
        last_name           : temp.last_name,
        email               : temp.email,
        password            : temp.password,
        last_library_key    : null,
        user_key            : '',
        user_id             : null
    };
    // verify that email is not in use
    let sql1 = `SELECT COUNT(email) AS email_count FROM users WHERE email = ?`;
    let query1 = db.query(sql1, newaccount.email, (err, rows, fields) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error creating account serverside');
            throw err;
        }
        // if email is in use send code 301 and exit
        if (rows[0].email_count != 0) {
            console.log("Email in use...");
            res.statusCode = 301;
            res.send ('Email is already in use');
            return;
        }
        // before creating the account, get a UUID for identification
        let sqlUUID = `SELECT UUID() AS UUID;`
        let queryUUID = db.query(sqlUUID, (err, result) => {
            if (err) {
                res.statusCode = 302;
                console.log('Error getting UUID...');
                throw err;
            }
            newaccount.user_key = result[0].UUID;
            // if the email is not in use, add the account to the server
            let sql = `INSERT INTO users SET ?`;
            let query = db.query(sql, newaccount, (err, result) => {
                if(err) {
                    res.statusCode = 310;
                    res.send('Unknown error creating account serverside');
                    throw err;
                }
                // if the account creation succeeds, send status code 200 and the new account JSON
                console.log(result);
                res.statusCode = 200;
                newaccount.account_id = result.insertId;
                res.json(newaccount);
            });
        });
    });
});

// Returns a users account information
app.post(path + '/users/login', (req, res) => {
    console.log('Logging in...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...' + req.body.server_password);
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // verify that the account exists
    let sql1 = `SELECT COUNT(email) AS email_count FROM users WHERE email = '${req.body.email}'`;
    let query1 = db.query(sql1, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error logging account serverside');
            throw err;
        }
        // if the account does not exist, send status code 311 and exit
        if (result[0].email_count != 1) {
            console.log('Email does not exist...');
            res.statusCode = 311;
            res.send('Email does not exist');
            return;
        }
        // if the account exists, attempt to login
        let sql2 = `SELECT * FROM users WHERE email = '${req.body.email}' && password = '${req.body.password}'`;
        let query2 = db.query(sql2, (err, result) => {
            if(err) {
                res.statusCode = 310;
                res.send('Unknown error logging account serverside');
                throw err;
            }
            // if the password is incorrect, send status code 312 and exit
            if (result[0] == null) {
                console.log('Invalid password...');
                res.statusCode = 312;
                res.send('Invalid password');
                return;
            }
            var temp = {
                first_name          : result[0].first_name,
                last_name           : result[0].last_name,
                email               : result[0].email,
                password            : result[0].password,
                last_library_key    : result[0].last_library_key,
                user_key            : result[0].user_key,
                user_id             : result[0].user_id,
                role                : null,
                checkout_limit      : null,
                user_book_count     : null
            }
            // if the account is successfully logged in send status code 200 and the user JSON
            // if the user has a last library key, send the last libraries permissions too
            if (result[0].last_library_key != null) {
                let getpermissionssql = `SELECT * FROM library_permissions WHERE user_key = '${temp.user_key}' && library_key = '${temp.last_library_key}'`;
                let queryPermissions = db.query(getpermissionssql, (err, result) => {
                    if(err) {
                        res.statusCode = 310;
                        res.send('Unknown error logging into library serverside');
                        throw err;
                    }
                    // if the library is not found, send status code 341 and exit
                    if (result[0] == null) {
                        res.statusCode = 339;
                        res.send('User does not belong to this library');
                        return;
                    }
                    // send back library permissions after signed in
                    console.log(temp.email + ' logged in.');
                    temp.role = result[0].role;
                    temp.checkout_limit = result[0].checkout_limit;
                    temp.user_book_count = result[0].user_book_count;
                    res.statusCode = 200;
                    res.json(temp);
                });
            } else {
                console.log(result[0].email + ' logged in.');
                res.statusCode = 200;
                res.json(result[0]);
            }
        });
    });
});

// Returns all users
app.post(path + '/users/getusers', (req, res) => {
    console.log('Getting users...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...' + req.body.server_password);
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all users
    let sql = `SELECT * FROM users`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error getting all users serverside');
            throw err;
        }
        // if the users are successfully retrieved send status code 200 and the users in a JSON array
        console.log('Users retrieved.');
        res.statusCode = 200;
        res.json(result);
    });
});

// Returns all books checked out and reserved by user, requires user key and server password
app.post(path + '/users/getuserbooks/:serverpassword', (req, res) => {
    console.log('Getting users...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all user's checked out and reserved books
    let sql = `SELECT * FROM books WHERE user_key = '${req.body.user_key}'`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 311;
            res.send('Unknown error getting all checked out books serverside');
            throw err;
        }
        // if the users are successfully retrieved send status code 200 and the users in a JSON array
        console.log('Checked out and reserved books retrieved.');
        res.statusCode = 200;
        res.json(result);
    });
});

// Returns all books checked out and reserved by user from a library, requires user key and library key and server password
app.post(path + '/users/getlibraryuserbooks/:serverpassword', (req, res) => {
    console.log('Getting users...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all user's checked out and reserved books from a library
    let sql = `SELECT * FROM books WHERE user_key = '${req.body.user_key}' && library_key = '${req.body.library_key}'`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 312;
            res.send('Unknown error getting all checked out books from a library serverside');
            throw err;
        }
        // if the users are successfully retrieved send status code 200 and the users in a JSON array
        console.log('Checked out and reserved books retrieved from a library.');
        res.statusCode = 200;
        res.json(result);
    });
});



/***** LIBRARIES *****/



// Creates a new library
app.post(path + '/libraries/create', (req, res) => {
    console.log('Creating library...');
    var temp = req.body;
    // if the sender is not using the correct server password, send code 299 and exit
    if (temp.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // create new account template, user_key is added later
    var newlibrary = {
        name                    : temp.name,
        librarian_password      : temp.librarian_password,
        teacher_password        : temp.teacher_password,
        general_password        : temp.general_password,
        general_checkout_limit  : temp.general_checkout_limit,
        library_key             : '',
        library_id              : null
    };
    // attach creator to library
    var newlibrarypermission = {
        user_key                : temp.user_key,
        library_key             : null,
        role                    : 'C',
        checkout_limit          : 1000
    }
    // verify that the name is not already in use
    let sql1 = `SELECT COUNT(name) AS name_count FROM libraries WHERE name = ?`;
    let query1 = db.query(sql1, newlibrary.name, (err, rows, fields) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error creating library serverside');
            throw err;
        }
        // if library name is in use send code 321 and exit
        if (rows[0].name_count != 0) {
            console.log("Library name in use...");
            res.statusCode = 321;
            res.send ('Library name is already in use');
            return;
        }
        // before creating the library, get a UUID for identification
        let sqlUUID = `SELECT UUID() AS UUID;`
        let queryUUID = db.query(sqlUUID, (err, result) => {
            if (err) {
                res.statusCode = 302;
                console.log('Error getting UUID...');
                throw err;
            }
            newlibrary.library_key = result[0].UUID;
            newlibrarypermission.library_key = newlibrary.library_key;
            // if the name is not in use, add the library to the server and attach creator permissions
            let sqlpermissions = `INSERT INTO library_permissions SET ?`;
            let query = db.query(sqlpermissions, newlibrarypermission, (err, result) => {
                if(err) {
                    res.statusCode = 310;
                    res.send('Unknown error creating library serverside');
                    throw err;
                }
                let sql = `INSERT INTO libraries SET ?;` +
                          `UPDATE users SET last_library_key = '${newlibrary.library_key}' WHERE user_key = '${req.body.user_key}'`;
                let query2 = db.query(sql, newlibrary, (err, result) => {
                    if(err) {
                        res.statusCode = 310;
                        res.send('Unknown error creating library serverside');
                        throw err;
                    }
                    // if the library creation succeeds, send status code 200 and the new library JSON
                    console.log(result);
                    res.statusCode = 200;
                    newlibrary.library_id = result.insertId;
                    res.json(newlibrary);
                });
            });
        });
    });
});

// Returns a all libraries
app.post(path + '/libraries/getlibraries', (req, res) => {
    console.log('Getting libraries...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all libraries
    let sql = `SELECT * FROM libraries`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error getting all libraries serverside');
            throw err;
        }
        // if the libraries are successfully retrieved send status code 200 and the libraries in a JSON array
        console.log('Libraries retrieved.');
        res.statusCode = 200;
        res.json(result);
    });
});

// Returns a specified library
app.post(path + '/libraries/getlibrary', (req, res) => {
    console.log('Getting library...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for the specified library
    let sql = `SELECT * FROM libraries WHERE library_key = '${req.body.library_key}'`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error getting specified library serverside');
            throw err;
        }
        // if the library does not exist, send status code 331 and exit
        if (result[0] == null) {
            res.statusCode = 331;
            res.send('Invalid key');
            return;
        }
        // if the library is successfully retrieved send status code 200 and the library JSON
        console.log('Library ' + result[0].name + ' retrieved.');
        res.statusCode = 200;
        res.json(result[0]);
    });
});

// Logs user into a specified library given user and library key and server password
// This is only used for accounts already belonging to the library
app.post(path + '/libraries/logintolibrary', (req, res) => {
    console.log('Logging into library...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    let getpermissionssql = `SELECT * FROM library_permissions WHERE user_key = '${req.body.user_key}' && library_key = '${req.body.library_key}'`;
    let query = db.query(getpermissionssql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error logging into library serverside');
            throw err;
        }
        // if the library is not found, send status code 341 and exit
        if (result[0] == null) {
            res.statusCode = 339;
            res.send('User does not belong to this library');
            return;
        }
        var library_permissions = result[0];
        // update users's last library
        let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
        let updatequery = db.query(lastlibrarysql, (err, result) => {
            if(err) {
                res.statusCode = 310;
                res.send('Unknown error logging into library serverside');
                throw err;
            }
            // send back library permissions after signed in
            res.statusCode = 200;
            res.json(library_permissions);
            console.log('Library logged into as ' + library_permissions.role + '.');
        });
    });
});

// Sign user into a specified library given user information, password required on first access
// Login credentials must require the server_password, library_key and the user_key and general password of the library
app.post(path + '/libraries/signintolibrarygeneral', (req, res) => {
    console.log('Getting library...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server to check if the user already belongs to the library, if so log them in and exit
    let sqlpermissions = `SELECT * FROM library_permissions WHERE library_key = '${req.body.library_key}' && user_key = '${req.body.user_key}'`;
    let query = db.query(sqlpermissions, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error signing into library serverside');
            throw err;
        }
        var success = false;
        // if the library permission is found, send status code 200 and the permission JSON
        if (result[0] != null) {
            var library_permissions = result[0];
            success = true;
            // update users's last library
            let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
            let updatequery = db.query(lastlibrarysql, (err, result) => {
                if(err) {
                    res.statusCode = 310;
                    res.send('Unknown error logging into library serverside');
                    throw err;
                }
                // send back library permissions after signed in
                res.statusCode = 200;
                res.json(library_permissions);
                console.log('Library logged into as ' + library_permissions.role + '.');
                return;
            });
        }
        // if the user does not already belong to the library, attempt to sign them in
        if (!success) {
            // query server for the specified library
            let sqllibrary = `SELECT * FROM libraries WHERE library_key = '${req.body.library_key}' && general_password = '${req.body.general_password}'`;
            let query2 = db.query(sqllibrary, (err, result) => {
                if(err) {
                    res.statusCode = 310;
                    res.send('Unknown error logging into library serverside');
                    throw err;
                }
                // if the library is not found, send status code 341 and exit
                if (result[0] == null) {
                    res.statusCode = 341;
                    res.send('Invalid library password');
                    return;
                }
                // if the correct password was found, add library permissions for the user to server and return permissions
                var library_permissions = {
                    user_key        : req.body.user_key,
                    library_key     : req.body.library_key,
                    role            : 'G',
                    checkout_limit  : result[0].general_checkout_limit,
                    user_book_count : 0
                }
                let sqladdpermissions = `INSERT INTO library_permissions SET ?`
                let query3 = db.query(sqladdpermissions, library_permissions, (err, result) => {
                    if(err) {
                        res.statusCode = 310;
                        res.send('Unknown error adding permissions serverside');
                        throw err;
                    }
                    // update users's last library
                    let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
                    let updatequery = db.query(lastlibrarysql, (err, result) => {
                        if(err) {
                            res.statusCode = 310;
                            res.send('Unknown error logging into library serverside');
                            throw err;
                        }
                        // send back library permissions after signed in
                        res.statusCode = 200;
                        res.json(library_permissions);
                        console.log('Library logged into as ' + library_permissions.role + '.');
                    });
                });
            });
        }
    });
});

// Sign user into a specified library given user information, password required on first access
// Login credentials must require the server_password, library_key and the user_key and teacher password of the library
app.post(path + '/libraries/signintolibraryteacher', (req, res) => {
    console.log('Getting library...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server to check if the user already belongs to the library, if so log them in and exit
    let sqlpermissions = `SELECT * FROM library_permissions WHERE library_key = '${req.body.library_key}' && user_key = '${req.body.user_key}'`;
    let query = db.query(sqlpermissions, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error signing into library serverside');
            throw err;
        }
        var permissions_exist = false;
        var library_permissions = null;
        var success = false;
        // if the library permission is found, check to see if the permission is greater than or equal to teacher
        if (result[0] != null) {
            // send back the library after the user is logged in
            library_permissions = result[0];
            if (library_permissions.role != 'G') {
                success = true;
                // update users's last library
                let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
                let updatequery = db.query(lastlibrarysql, (err, result) => {
                    if(err) {
                        res.statusCode = 310;
                        res.send('Unknown error logging into library serverside');
                        throw err;
                    }
                    // send back library permissions after signed in
                    res.statusCode = 200;
                    res.json(library_permissions);
                    console.log('Library logged into as ' + library_permissions.role + '.');
                    return;
                });
            }
            permissions_exist = true;
        }
        // if the user does not already belong to the library, attempt to sign them in
        if (!success) {
            // query server for the specified library
            let sqllibrary = `SELECT * FROM libraries WHERE library_key = '${req.body.library_key}' && teacher_password = '${req.body.teacher_password}'`;
            let query2 = db.query(sqllibrary, (err, result) => {
                if(err) {
                    res.statusCode = 310;
                    res.send('Unknown error logging into library serverside');
                    throw err;
                }
                // if the library is not found, send status code 341 and exit
                if (result[0] == null) {
                    res.statusCode = 341;
                    res.send('Invalid library password');
                    return;
                }
                // if the correct password was found, add library permissions for the user to server and return permissions if permissions do not already exist
                if (!permissions_exist) {
                    library_permissions = {
                        user_key        : req.body.user_key,
                        library_key     : req.body.library_key,
                        role            : 'T',
                        checkout_limit  : 1000,
                        user_book_count : 0
                    }
                    let sqladdpermissions = `INSERT INTO library_permissions SET ?`;
                    let query3 = db.query(sqladdpermissions, library_permissions, (err, result) => {
                        if(err) {
                            res.statusCode = 310;
                            res.send('Unknown error adding permissions serverside');
                            throw err;
                        }
                        // update users's last library
                        let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
                        let updatequery = db.query(lastlibrarysql, (err, result) => {
                            if(err) {
                                res.statusCode = 310;
                                res.send('Unknown error logging into library serverside');
                                throw err;
                            }
                            // send back library permissions after signed in
                            res.statusCode = 200;
                            res.json(library_permissions);
                            console.log('Library logged into as ' + library_permissions.role + '.');
                        });
                    });
                }
                else {
                    library_permissions.role = 'T';
                    let sqlupdatepermissions = `UPDATE library_permissions SET role = 'T' WHERE library_key = '${req.body.library_key}' && user_key = '${req.body.user_key}';` +
                                            `UPDATE library_permissions SET checkout_limit = 1000 WHERE library_key = '${req.body.library_key}' && user_key = '${req.body.user_key}';`;
                    let query3 = db.query(sqlupdatepermissions, (err, result) => {
                        if(err) {
                            res.statusCode = 310;
                            res.send('Unknown error updating permissions serverside');
                            throw err;
                        }
                        // update users's last library
                        let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
                        let updatequery = db.query(lastlibrarysql, (err, result) => {
                            if(err) {
                                res.statusCode = 310;
                                res.send('Unknown error logging into library serverside');
                                throw err;
                            }
                            // send back library permissions after signed in
                            res.statusCode = 200;
                            res.json(library_permissions);
                            console.log('Library logged into as ' + library_permissions.role + '.');
                        });
                    });
                }
            });
        }
    });
});

// Sign user into a specified library given user information, password required on first access
// Login credentials must require the server_password, library_key and the user_key and librarian password of the library
app.post(path + '/libraries/signintolibrarylibrarian', (req, res) => {
    console.log('Getting library...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server to check if the user already belongs to the library, if so log them in and exit
    let sqlpermissions = `SELECT * FROM library_permissions WHERE library_key = '${req.body.library_key}' && user_key = '${req.body.user_key}'`;
    let query = db.query(sqlpermissions, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error signing into library serverside');
            throw err;
        }
        var permissions_exist = false;
        var success = false;
        var library_permissions = null;
        // if the library permission is found, check to see if the permission is greater than or equal to librarian
        if (result[0] != null) {
            // send back the library after the user is logged in
            library_permissions = result[0];
            if (library_permissions.role != 'G' && library_permissions.role != 'T') {
                success = true;
                // update users's last library
                let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
                let updatequery = db.query(lastlibrarysql, (err, result) => {
                    if(err) {
                        res.statusCode = 310;
                        res.send('Unknown error logging into library serverside');
                        throw err;
                    }
                    // send back library permissions after signed in
                    res.statusCode = 200;
                    res.json(library_permissions);
                    console.log('Library logged into as ' + library_permissions.role + '.');
                    return;
                });
            }
            permissions_exist = true;
        }
        // if the user does not already belong to the library, attempt to sign them in
        if (!success) {
            // query server for the specified library
            let sqllibrary = `SELECT * FROM libraries WHERE library_key = '${req.body.library_key}' && librarian_password = '${req.body.librarian_password}'`;
            let query2 = db.query(sqllibrary, (err, result) => {
                if(err) {
                    res.statusCode = 310;
                    res.send('Unknown error logging into library serverside');
                    throw err;
                }
                // if the library is not found, send status code 341 and exit
                if (result[0] == null) {
                    res.statusCode = 341;
                    res.send('Invalid library password');
                    return;
                }
                // if the correct password was found, add library permissions for the user to server and return permissions if permissions do not already exist
                if (!permissions_exist) {
                    library_permissions = {
                        user_key        : req.body.user_key,
                        library_key     : req.body.library_key,
                        role            : 'L',
                        checkout_limit  : 1000,
                        user_book_count : 0
                    }
                    let sqladdpermissions = `INSERT INTO library_permissions SET ?`;
                    let query3 = db.query(sqladdpermissions, library_permissions, (err, result) => {
                        if(err) {
                            res.statusCode = 310;
                            res.send('Unknown error adding permissions serverside');
                            throw err;
                        }
                        // update users's last library
                        let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
                        let updatequery = db.query(lastlibrarysql, (err, result) => {
                            if(err) {
                                res.statusCode = 310;
                                res.send('Unknown error logging into library serverside');
                                throw err;
                            }
                            // send back library permissions after signed in
                            res.statusCode = 200;
                            res.json(library_permissions);
                            console.log('Library logged into as ' + library_permissions.role + '.');
                        });
                    });
                }
                else {
                    library_permissions.role = 'L';
                    let sqlupdatepermissions = `UPDATE library_permissions SET role = 'L' WHERE library_key = '${req.body.library_key}' && user_key = '${req.body.user_key}';` + 
                                            `UPDATE library_permissions SET checkout_limit = 1000 WHERE library_key = '${req.body.library_key}' && user_key = '${req.body.user_key}';`;
                    let query3 = db.query(sqlupdatepermissions, (err, result) => {
                        if(err) {
                            res.statusCode = 310;
                            res.send('Unknown error updating permissions serverside');
                            throw err;
                        }
                        // update users's last library
                        let lastlibrarysql = `UPDATE users SET last_library_key = '${req.body.library_key}' WHERE user_key = '${req.body.user_key}'`;
                        let updatequery = db.query(lastlibrarysql, (err, result) => {
                            if(err) {
                                res.statusCode = 310;
                                res.send('Unknown error logging into library serverside');
                                throw err;
                            }
                            // send back library permissions after signed in
                            res.statusCode = 200;
                            res.json(library_permissions);
                            console.log('Library logged into as ' + library_permissions.role + '.');
                        });
                    });
                }
            });
        }
    });
});

// get all reserved books from a library
app.post(path + '/libraries/getreservedbooks', (req, res) => {
    console.log('Getting reserved books...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all reserved books from the library
    let sql = `SELECT * FROM books WHERE library_key = '${req.body.library_key}' && reserved = TRUE`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error getting all reserved books from the library serverside');
            throw err;
        }
        // if the books are successfully retrieved send status code 200 and the books in a JSON array
        console.log('Reserved books retrieved.');
        res.statusCode = 200;
        res.json(result);
    });
});

// get all checked out books from a library
app.post(path + '/libraries/getcheckedoutbooks', (req, res) => {
    console.log('Getting checked out books...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all reserved books from the library
    let sql = `SELECT * FROM books WHERE library_key = '${req.body.library_key}' && checked_out = TRUE`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error getting all checked out books from the library serverside');
            throw err;
        }
        // if the books are successfully retrieved send status code 200 and the books in a JSON array
        console.log('Checked out books retrieved.');
        res.statusCode = 200;
        res.json(result);
    });
});

// get all books from a library
app.post(path + '/libraries/getbooks', (req, res) => {
    console.log('Getting books...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all books from the library
    let sql = `SELECT * FROM books WHERE library_key = '${req.body.library_key}'`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error getting all books from the library serverside');
            throw err;
        }
        // if the books are successfully retrieved send status code 200 and the books in a JSON array
        console.log('Books retrieved.');
        res.statusCode = 200;
        res.json(result);
    });
});



/***** BOOKS *****/



// Creates a new book
app.post(path + '/books/create', (req, res) => {
    console.log('Creating book...');
    var temp = req.body;
    // if the sender is not using the correct server password, send code 299 and exit
    if (temp.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // create new account template, user_key is added later
    var newbook = {
        name                : temp.name,
        author_first_name   : temp.author_first_name,
        author_last_name    : temp.author_last_name,
        year_published      : temp.year_published,
        library_key         : temp.library_key,
        book_key            : '',
        book_id             : null
    };
    // before creating the book, get a UUID for identification
    let sqlUUID = `SELECT UUID() AS UUID;`
    let queryUUID = db.query(sqlUUID, (err, result) => {
        if (err) {
            res.statusCode = 302;
            console.log('Error getting UUID...');
            throw err;
        }
        newbook.book_key = result[0].UUID;
        // add the book to the server
        let sql = `INSERT INTO books SET ?`;
        let query = db.query(sql, newbook, (err, result) => {
            if(err) {
                res.statusCode = 310;
                res.send('Unknown error creating book serverside');
                throw err;
            }
            // if the book creation succeeds, send status code 200 and the new book JSON
            console.log(result);
            res.statusCode = 200;
            newbook.book_id = result.insertId;
            res.json(newbook);
        });
    });
});

// reserve a book, requires server password, user key, book key, library key
app.post(path + '/books/reservebook/:reservecredentials', (req, res) => {
    console.log('Reserving book...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // verify that the book has not already been checked out or reserved
    let sqlbook = `SELECT * FROM books WHERE book_key = '${req.body.book_key}'`;
    let querybook = db.query(sqlbook, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error reserving book serverside');
            throw err;
        }
        var book = result[0];
        // if the book has been deleted, exit
        if (book == null) {
            console.log('Requested book has been deleted...');
            res.statusCode = 351;
            res.send('Requested book has been deleted');
            return;
        }
        if (book.user_key != null) {
            console.log('Requested book has been already been checked out/reserved...');
            res.statusCode = 352;
            res.send('Requested book has already been requested');
            return;
        }
        // reserve the book for the user
        let sqlupdatebook = `UPDATE books SET user_key = '${req.body.user_key}' WHERE book_key = '${req.body.book_key}';` +
                            `UPDATE books SET reserved = TRUE WHERE book_key = '${req.body.book_key}';` +
                            `UPDATE books SET date_reserved = NOW() WHERE book_key = '${req.body.book_key}';` +
                            `UPDATE library_permissions SET user_book_count = user_book_count + 1 WHERE user_key = '${req.body.user_key}' && library_key = '${req.body.library_key}';`;
        let queryupdatebook = db.query(sqlupdatebook, (err, result) => {
            if(err) {
                res.statusCode = 310;
                res.send('Unknown error reserving book serverside');
                throw err;
            }
            console.log('Book reserved...');
            res.statusCode = 200;
            res.send('Book reserved');
            return;
        });
    });
});

// unreserve a book, requires server password, user key, book key, library key
app.post(path + '/books/unreservebook/:reservecredentials', (req, res) => {
    console.log('Unreserving book...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // unreserve the book for the user
    let sqlupdatebook = `UPDATE books SET user_key = NULL WHERE book_key = '${req.body.book_key}';` +
                        `UPDATE books SET reserved = FALSE WHERE book_key = '${req.body.book_key}';` +
                        `UPDATE books SET date_reserved = NULL WHERE book_key = '${req.body.book_key}';` +
                        `UPDATE library_permissions SET user_book_count = user_book_count - 1 WHERE user_key = '${req.body.user_key}' && library_key = '${req.body.library_key}';`;
    let queryupdatebook = db.query(sqlupdatebook, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error unreserving book serverside');
            throw err;
        }
        console.log('Book unreserved...');
        res.statusCode = 200;
        res.send('Book unreserved');
        return;
    });
});

// check out a book, requires server password, book key
// this can only be called by librarians and creators in a library
app.post(path + '/books/checkoutbook/:checkoutcredentials', (req, res) => {
    console.log('Checking out book...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // verify that the book has not been deleted
    let sqlbook = `SELECT * FROM books WHERE book_key = '${req.body.book_key}'`;
    let querybook = db.query(sqlbook, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error checking out book serverside');
            throw err;
        }
        var book = result[0];
        // if the book has been deleted, exit
        if (book == null) {
            console.log('Requested book has been deleted...');
            res.statusCode = 361;
            res.send('Requested book has been deleted');
            return;
        }
        // check out the book for the user
        let sqlupdatebook = `UPDATE books SET reserved = FALSE WHERE book_key = '${req.body.book_key}';` +
                            `UPDATE books SET date_reserved = NULL WHERE book_key = '${req.body.book_key}';` +
                            `UPDATE books SET checked_out = TRUE WHERE book_key = '${req.body.book_key}';` +
                            `UPDATE books SET date_checked_out = NOW() WHERE book_key = '${req.body.book_key}';`;
        let queryupdatebook = db.query(sqlupdatebook, (err, result) => {
            if(err) {
                res.statusCode = 310;
                res.send('Unknown error checking out book serverside');
                throw err;
            }
            console.log('Book checked out...');
            res.statusCode = 200;
            res.send('Book checked out');
            return;
        });
    });
});

// return a book, requires server password, user key, book key, library key
app.post(path + '/books/returnbook/:returncredentials', (req, res) => {
    console.log('Returning book...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // unreserve the book for the user
    let sqlupdatebook = `UPDATE books SET user_key = NULL WHERE book_key = '${req.body.book_key}';` +
                        `UPDATE books SET checked_out = FALSE WHERE book_key = '${req.body.book_key}';` +
                        `UPDATE books SET date_checked_out = NULL WHERE book_key = '${req.body.book_key}';` +
                        `UPDATE library_permissions SET user_book_count = user_book_count - 1 WHERE user_key = '${req.body.user_key}' && library_key = '${req.body.library_key}';`;
    let queryupdatebook = db.query(sqlupdatebook, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error returning book serverside');
            throw err;
        }
        console.log('Book returned...');
        res.statusCode = 200;
        res.send('Book returned');
        return;
    });
});

// get all books
app.post(path + '/books/getallbooks/:serverinfo', (req, res) => {
    console.log('Getting books...');
    // if the sender is not using the correct server password, send code 299 and exit
    if (req.body.server_password != server_password) {
        console.log('Invalid server password request...');
        res.statusCode = 299;
        res.send('Incorrect server password');
        return;
    }
    // query server for all books
    let sql = `SELECT * FROM books`;
    let query = db.query(sql, (err, result) => {
        if(err) {
            res.statusCode = 310;
            res.send('Unknown error getting all books serverside');
            throw err;
        }
        // if the books are successfully retrieved send status code 200 and the books in a JSON array
        console.log('All books retrieved.');
        res.statusCode = 200;
        res.json(result);
    });
});

app.listen(9801, () => {
    console.log('Server started on port 9801.');
});