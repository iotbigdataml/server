//import {PythonShell} from 'python-shell';

/******************************************************************************************************************
* File:REST.js
* Course: IOT, Data Science, Machine Learning
* Project: Fullfillment Center
* Copyright: Copyright (c) 2018 Carnegie Mellon University
* Versions:
*   1.0 April 2018 - Initial write of course order server demo (lattanze).
*
* Description: This module provides the restful webservices for the Server.js Node server. This module contains GET,
* POST, and DELETE services.
*
* Parameters:
*   router - this is the URL from the client
*   connection - this is the connection to the database
*   md5 - This is the md5 hashing/parser... included by convention, but not really used
*
* Internal Methods:
*   router.get("/"... - returns the system version information
*   router.get("/orders"... - returns a listing of everything in the ws_orderinfo database
*   router.get("/orders/:order_id"... - returns the data associated with order_id
*   router.post("/order?"... - adds the new customer data into the ws_orderinfo database
*
* External Dependencies: mysql
*
******************************************************************************************************************/

var mysql = require("mysql");     //Database
var utils = require("./utils.js");
var requests = require('request');

function REST_ROUTER(router, connection) {
    var self = this;
    self.handleRoutes(router, connection);
}

// Here is where we define the routes. Essentially a route is a path taken through the code dependent upon the
// contents of the URL

REST_ROUTER.prototype.handleRoutes = function (router, connection) {

    // GET with no specifier - returns system version information
    // req paramdter is the request object
    // res parameter is the response object

    router.get("/", function (req, res) {
        res.json({ "Message": "Orders Webservices Server Version 1.0" });
    });

    // Modified by CJ - 04/26/2019
    // GET for /now - returns the current simulation time of the server.

    router.get("/now", function (req, res) {
        res.json({ "Now": utils.now().toLocaleString() });
    });

    // GET for /timeconfig - returns the simulation configuration.

    router.get("/timeconfig", function (req, res) {
        res.json(utils.getConfig());
    });

    // GET for /orders specifier - returns all pending orders currently stored in the database
    // req paramdter is the request object
    // res parameter is the response object
    // by default, pending orders are returned

    router.get("/orders/:status?", function (req, res) {
       // console.log("Getting all database entries...");

        if (req.params.status) {
            var query = `SELECT top.orderID, top.productID, top.qtyOnTrip, o.status, b.botID  
                        FROM tripOrderProducts top  
                        JOIN orders o ON top.orderID = o.orderID 
                        JOIN bots b on top.tripID = b.tripID;`;
        } else {
            var query = `SELECT op.orderID, p.productID, op.qtyOrdered, o.status 
                        FROM orderProducts op 
                        JOIN products p ON op.productID = p.productID 
                        JOIN orders o ON op.orderID = o.orderID;`;
        }

        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": err, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Success", "Orders": rows });
            }
        });
    });

    // POST to update order status
    router.post('/orders/update/:orderID', (req, res) => {
        var query = `UPDATE orders 
                    SET status = '${req.body.status}' 
                    WHERE orderID = ${req.params.orderID}`;

        connection.query(query, (err, rows) => {
            if (err) {
                res.json({ "Error": err, "Message": "Error executing MySQL query" });
            } else {
                if (req.body.status == "loaded") {
                    var query = `UPDATE ?? 
                                SET ?? = COALESCE(??, ?) WHERE ?? = ?`;
                    var table = ["orders", "loadTime", "loadTime", utils.now(), "orderID", req.params.orderID];

                    query = mysql.format(query, table);

                    connection.query(query, (err, rows) => {
                        if (err) {
                            res.json({ "Error": err, "Message": "Error executing MySQL query" });
                        } else {
                            var query = `SELECT productID, qtyOrdered 
                                        FROM orderProducts 
                                        WHERE orderID = '${req.params.orderID}';`;
                            connection.query(query, (err, rows) => {
                                if (err) {
                                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                                } else {
                                    errors = [];
                                    rows.forEach(element => {
                                        console.log(element);
                                        var query = "UPDATE ?? SET ?? = (?? - ?) WHERE ?? = ?";
                                        var table = ["products", "qtyInStock", "qtyInStock", parseInt(element.qtyOrdered), "productID", element.productID];
                                        query = mysql.format(query, table);
                                        console.log("\n\n\n" + query + "\n\n\n");
                                        connection.query(query, (err, rows) => {
                                            if (err) {
                                                errors.push(err);
                                            }
                                        });
                                    });
                                    if (errors.length > 0) {
                                        res.json({
                                            "errors": errors
                                        })
                                    } else {
                                        res.json({
                                            "status": "Success!"
                                        })
                                    }
                                }
                            })

                            // res.json({ "Error": false, "Message": "Success" });
                        }
                    });
                } else if (req.body.status == "shipped") {
                    var query = `UPDATE ?? 
                                SET ?? = ? WHERE ?? = ?`;
                    var table = ["orders", "fulfillTime", utils.now(), "orderID", req.params.orderID];

                    query = mysql.format(query, table);

                    connection.query(query, (err, rows) => {
                        if (err) {
                            res.json({ "Error": err, "Message": "Error executing MySQL query" });
                        } else {
                            res.json({ "Error": false, "Message": "Success" });
                        }
                    });
                } else if (req.body.status == "returned" && req.body.loaded) {
                    console.log("\n\nReplenishing order\n\n");
                    var query = `SELECT productID, qtyOrdered 
                                FROM orderProducts 
                                WHERE orderID = '${req.params.orderID}';`;
                    connection.query(query, (err, rows) => {
                        if (err) {
                            res.json({ "Error": err, "Message": "Error executing MySQL query" });
                        } else {
                            errors = [];
                            rows.forEach(element => {
                                console.log(element);
                                var query = "UPDATE products SET qtyInStock = qtyInStock + " + Number(element.qtyOrdered) + " WHERE productID = " + element.productID;
                                connection.query(query, (err, rows) => {
                                    if (err) {
                                        errors.push(err);
                                    }
                                });
                            });
                            if (errors.length > 0) {
                                res.json({
                                    "errors": errors
                                })
                            } else {
                                res.json({
                                    "status": "Success!"
                                })
                            }
                        }
                    })
                } else {
                    res.json({ "Error": false, "Message": "Success" });
                }
            }
        })
    })


    // GET for /pending/id specifier - returns the pending order for the provided order ID
    // req paramdter is the request object
    // res parameter is the response object

    router.get("/pending/:id", function (req, res) {
        console.log("Getting order ID: ", req.params.id);
        var query = "SELECT * FROM ?? WHERE ??=? AND ??=?";
        var table = ["orders", "orderID", req.params.id, "status", "pending"];
        query = mysql.format(query, table);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": true, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Success", "Users": rows });
            }
        });
    });

    // GET for /pendingcustorders specifier - returns the order for the provided order ID
    // req paramdter is the request object
    // res parameter is the response object

    router.get("/pendingcustorders/:customer", function (req, res) {
        console.log("Getting orders for: ", req.params.customer);
        var query = "SELECT * FROM ?? WHERE ??=? AND ??=?";
        var table = ["orders", "customerID", req.params.customer, "status", "pending"];
        query = mysql.format(query, table);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": true, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Success", "Users": rows });
            }
        });
    });

    // GET for /filled specifier - returns all filled orders currently stored in the database
    // req paramdter is the request object
    // res parameter is the response object

    router.get("/filled", function (req, res) {
        //console.log("Getting all database entries...");
        var query = "SELECT * FROM ?? WHERE ??=?";
        var table = ["orders", "status", "shipped"];
        query = mysql.format(query, table);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": true, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Success", "Orders": rows });
            }
        });
    });

    // GET for /filledcustorders specifier - returns the filled orders for the specified customer
    // req paramdter is the request object
    // res parameter is the response object

    router.get("/filledcustorders/:customer", function (req, res) {
        console.log("Getting orders for: ", req.params.customer);
        var query = "SELECT * FROM ?? WHERE ??=? AND ??=?";
        var table = ["orders", "customerID", req.params.customer, "status", "shipped"];
        query = mysql.format(query, table);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": true, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Success", "Users": rows });
            }
        });
    });

    // POST for making a pending order as satisfied for the provided order ID
    // This moves the order specified by ID to the fulfilled table.
    // req paramdter is the request object
    // res parameter is the response object

    router.get("/markOrderFilled/:id", function (req, res) {
        console.log("Marking fulfilled order ID: ", req.params.id);
        var query = "UPDATE ?? SET ??=?, ??=? WHERE ??=?"
        // var table = ["orders", "pending", false, "filldate", new (Date), "id", req.params.id];
        // Modified by CJ - 04/25/2019
        // Use the simulation time to write database.
        var table = ["orders", "status", "shipped", "fulfillTime", utils.now(), "orderID", req.params.id];

        query = mysql.format(query, table);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": true, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Order marked filled", "Users": rows });
            }
        });
    });

    // POST for adding orders
    // req paramdter is the request object - note to get parameters (eg. stuff afer the '?') you must use req.body.param
    // res parameter is the response object

    router.post("/neworder", function (req, res) {
        console.log("Adding order::", req.body.customer, ",", req.body.red, ",", req.body.blue, ",", req.body.green, ",", req.body.yellow, ",", req.body.black, ",", req.body.white);
        // Modified by CJ - 04/25/2019
        // Use the simulation time to write database.
        console.log(req.body);
        var productIDs = [1, 3, 2, 5, 4, 6];
        var product_to_bot_map = new Map([[1, 11], [3, 11], [2, 11], [5, 12], [4, 12], [6, 12]])
        var productQtys = [Number(req.body.red), Number(req.body.blue), Number(req.body.green), Number(req.body.yellow), Number(req.body.black), Number(req.body.white)];
        var bot_time_since_rec_arrival
        var num_bots_to_fulfill

        var order_bots = new Set([]);
        for (i = 0; i < productQtys.length; i++) {
            if (productQtys[i] > 0) {
                order_bots.add(product_to_bot_map.get(productIDs[i]));
            }
        }
        num_bots_to_fulfill = order_bots.size;

        var query;
        var table;
        if (num_bots_to_fulfill == 1) {
            query = "SELECT (now() - ??) FROM ?? WHERE ?? = (SELECT MAX(??) FROM ?? WHERE ?? = ?)";
            table = ["recArrivalTime", "trips", "tripID", "tripID", "trips", "botID", order_bots.values().next().value];
        } else {
            query = "SELECT (now() - ??) FROM ?? WHERE ?? = (SELECT MAX(??) FROM ??)";
            table = ["recArrivalTime", "trips", "tripID", "tripID", "trips"]
        }

        query = mysql.format(query, table);
        console.log(query);

        connection.query(query, function (err, rows, fields) {
            if (err) {
                res.json({ "Error": true, "Message": err });
            } else {
                if (rows[0]) {
                    bot_time_since_rec_arrival = rows[0];
                } else {
                    bot_time_since_rec_arrival = 45; // this value is arbitrary, would preferably use meaningful logic
                }

                var query = "INSERT INTO ?? (??,??,??,??) VALUES (?,?,?,?)";
                var table = ["orders", "createTime", "num_bots_to_fulfill", "bot_time_since_rec_arrival", "customerID",
                            utils.now(), num_bots_to_fulfill, bot_time_since_rec_arrival, Number(req.body.customer)];
                query = mysql.format(query, table);

                console.log(query)
                connection.query(query, function (err, rows, fields) {
                    if (err) {
                        console.log(err)
                        res.json({ "Error": true, "Message": err });
                    } else {
                        var query = "SELECT MAX(??) AS ?? FROM ??";
                        var table = ["orderID", "orderID", "orders"];
                        query = mysql.format(query, table);
                        
                        console.log(query)
                        connection.query(query, function (err, result, fields) {
                            if (err) {
                                res.json({ "Error": err, "Message": "Error executing MySQL query" });
                            } else {

                                for (i = 0; i < productQtys.length; i++) {

                                    var posts = [];

                                    if (productQtys[i] > 0) {

                                        // posts.push("INSERT INTO orders (orderID, productID, quantity) VALUES (${rows})

                                        var query = "INSERT INTO ??(??,??,??) VALUES (?,?,?)";
                                        var table = ["orderProducts", "orderID", "productID", "qtyOrdered", result[0].orderID, productIDs[i], productQtys[i]];

                                        query = mysql.format(query, table);

                                        console.log(query);

                                        connection.query(query, function (err, rows, fields) {
                                            if (err) {
                                                res.json({ "Error": err, "Message": "Error executing MySQL query" });
                                                return;
                                            }
                                        });
                                    }
                                }
                            }                   
                        });
                    }
                });
            }
        });
        
        res.json({ "Error": false, "Message": "Success"});
    });

    // DELETE for deleting a pending order as satisfied for the provided order ID
    // req paramdter is the request object
    // res parameter is the response object

    router.delete("/deleteOrder/:id", function (req, res) {
        console.log("Deleting order ID: ", req.params.id);
        var query = "DELETE FROM ?? WHERE ??=?";
        var table = ["orders", "ordersID", req.params.id];
        query = mysql.format(query, table);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": true, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Delete order OK", "Users": rows });
            }
        });
    });

    router.post('/replenish', (req, res) => {

    });

    // UPDATE a product quantity
    // req paramdter is the request object
    // res parameter is the response object
    router.post("/products/update/:productID", (req, res) => {
        console.log("Updating inventory for product: " + req.params.productID);
        var query = "UPDATE products SET qtyInStock = qtyInStock + " + Number(req.body.quantity) + " WHERE productID = " + req.params.productID;

        console.log(query);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": err, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Inventory Updated for" + req.params.productID });
            }
        });
    });

    router.post("/products/view/", (req, res) => {
        var query = "";
        if (req.body.assignedBot == null && req.body.productID == null) {
            console.log("productID and assignedBot are null, returning without filtering results");
            query = "SELECT * FROM products";
        }
        if (req.body.assignedBot != null) {
            console.log("querying for assignedBot::" + req.body.assignedBot);
            query = "SELECT * FROM products WHERE assignedBot = " + req.body.assignedBot;
        }
        if (req.body.productID != null) {
            console.log("querying for productId::" + req.body.productID);
            query = "SELECT * FROM products WHERE productID = \"" + req.body.productID + "\"";
        }
        if (req.body.productID != null && req.body.assignedBot != null) {
            console.log("querying for assignedBot::" + req.assignedBot + " alngwith querying for productId::" + req.body.productID);
            query = "SELECT * FROM products WHERE productID = \"" + req.body.productID + "\" AND assignedBot = " + req.body.assignedBot;
        }
        console.log(query);
        connection.query(query, function (err, rows) {
            if (err) {
                res.json({ "Error": err, "Message": "Error executing MySQL query" });
            } else {
                res.json({ "Error": false, "Message": "Product list retrieved", "products": rows });
            }
        });
    });


    router.get('/send-notification', (request, response) => {
        requests.get('http://172.17.0.1:5006/notify', (err, res, body) => {
            if (err) {
                console.log(err);
            }

            else if (res.statusCode == 200) {
                console.log("success");
            }

            response.json("success");


        })
    });

    
    router.post("/trips/update/bot/arrival", (req, res) => {
        console.log("inserting bot position...")
        console.log("Station: " + req.body.station);
        console.log("Bot: " + req.body.bot);
        var query = "";
        var table = "";
        if(req.body.station == "RECV") {
            query = "SET @TripID2 = (select max(??) from ??); update ?? set tripEndTime = ? where (tripID = @TripID2 OR tripID = (@TripID2 -1)) AND botID = ?";
            table = ["tripID", "trips", "trips", utils.now(), req.body.bot];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                    return;
                }
            });

            query = "INSERT INTO ??(??,??) VALUES (?,?)";
            table = ["trips", "botID", "recArrivalTime", req.body.bot, utils.now()];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                    return;
                }
            });

            query = "UPDATE ?? SET ?? = (SELECT MAX(??) FROM ?? WHERE ?? = ?) WHERE ?? = ?";
            table = ["bots", "tripID", "tripID", "trips", "botID", req.body.bot, "botID", req.body.bot];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query"});
                    return;
                } else {

                    const path = require('path')
                    const {spawn} = require('child_process')

                    function runScript(){
                        return spawn('python3', [
                        path.join(__dirname, 'tripOrderProducts.py')
                        ,req.body.bot]);
                    }

                    const subprocess = runScript()

                    subprocess.stdout.on('data', (data) => {
                        console.log(`data:${data}`);
                    });
                    subprocess.stderr.on('data', (data) => {
                        console.log(`error:${data}`);
                    });
                    subprocess.stderr.on('close', () => {
                        console.log("Closed");
                    });

                    // try { 
                    //         console.log("top: " + req.body.bot)
                    //         var spawn = require("child_process").spawn;
                    //         var pythonProcess = spawn('python', ["/iot-server/tripOrderProducts.py", req.body.bot])

                    //         pythonProcess.on('error', function(err) {
                    //             console.log(err)
                    //         })
                            
                    //         pythonProcess.stdout.on('data', (data) => {
                    //             console.log(data)
                    //     });

                    // } catch (err) {
                    //     console.log(err);
                    // }    
                    
                    // let options = {
                    //     args = [req.body.bot]
                    // }

                    // PythonShell.run('tripOrderProducts.py', options, function (err) {
                    //     if (err) throw err;
                    //     console.log('finished');
                    // });

                }
            });

        }
        if(req.body.station == "SHIP") {
            query = "SET @TripID2 = (select max(??) from ??); update ?? set shipArrivalTime = ? where (tripID = @TripID2 OR tripID = (@TripID2 -1)) AND botID = ?";
            table = ["tripID", "trips", "trips", utils.now(), req.body.bot];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                    return;
                }
            });
        }
        res.json("success");
    });

    router.post("/trips/update/bot/departure", (req, res) => {
        console.log("inserting bot position...")
        console.log("Station: " + req.body.station);
        console.log("Bot: " + req.body.bot);
        var query = "";
        var table = "";
        if(req.body.station == "RECV") {
            query = "SET @TripID2 = (select max(??) from ??); update ?? set recDepartureTime = ? where (tripID = @TripID2 OR tripID = (@TripID2 -1)) AND botID = ?";
            table = ["tripID", "trips", "trips", utils.now(), req.body.bot];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                    return;
                }
            });
        }
        if(req.body.station == "SHIP") {
            query = "SET @TripID2 = (select max(??) from ??); update ?? set shipDepartureTime = ? where (tripID = @TripID2 OR tripID = (@TripID2 -1)) AND botID = ?";
            table = ["tripID", "trips", "trips", utils.now(), req.body.bot];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                    return;
                }
            });
        }
        res.json("success");
    });

    router.post("/trips/update/bot/maintenance/start", (req, res) => {
        console.log("inserting bot position...")
        console.log("Station: " + req.body.station);
        var query = "";
        var table = "";
        if(req.body.station == "MAINTENANCE_START") {
            query = "SET @TripID2 = (select max(??) from ??); update ?? set maintenance_start = ? where (tripID = @TripID2 OR tripID = (@TripID2 -1))";
            table = ["tripID", "trips", "trips", utils.now()];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                    return;
                }
            });
        }
        res.json("success");
    });

    router.post("/trips/update/bot/maintenance/stop", (req, res) => {
        console.log("inserting bot position...")
        console.log("Station: " + req.body.station);
        var query = "";
        var table = "";
        if(req.body.station == "MAINTENANCE_START") {
            query = "SET @TripID2 = (select max(??) from ??); update ?? set maintenance_stop = ? where (tripID = @TripID2 OR tripID = (@TripID2 -1))";
            table = ["tripID", "trips", "trips", utils.now()];
            query = mysql.format(query, table);
            console.log(query);
            connection.query(query, function (err, rows, fields) {
                if (err) {
                    res.json({ "Error": err, "Message": "Error executing MySQL query" });
                    return;
                }
            });
        }
        res.json("success");
    });


    router.post("/loadTrip", (req, res) => {
        var query = "";
        //var table = "";
        
        query = `UPDATE orders o SET status = 'loaded', loadTime = ? 
			WHERE status = 'pending' and orderID in (SELECT distinct (orderID) 
                                FROM tripOrderProducts 
                                WHERE tripID  = (select MAX(tripID) from tripOrderProducts))`;
	table = [utils.now()];
	query = mysql.format(query, table);
        console.log(query);
        connection.query(query, function (err, rows, fields) {
            if (err) {
                res.json({ "Error": err, "Message": "Error executing MySQL query" });
                return;
            }
	    else res.json("success");
        });
    
	  // res.json("success");
    });

    router.post("/fulfillOrder", (req, res) => {
        var query = "";
        //var table = "";
        query = `select distinct orderID
                from(
                SELECT DISTINCT(op.orderID), SUM(op.qtyOrdered) as ordered, SUM(op.qtyLoaded) as loaded
                FROM tripOrderProducts top
                JOIN orderProducts op on op.orderID = top.orderID AND op.productID and top.productID = op.productID
		JOIN orders o on top.orderID = o.orderID 
                WHERE top.tripID = (select MAX(tripID) from tripOrderProducts) and o.status = loaded
                group by op.orderID) as temp
                WHERE ordered = loaded`;
        //table = ["tripID", "trips", "trips", utils.now()];
        //query = mysql.format(query);
        console.log(query);
        connection.query(query, function (err, rows, fields) {
            if (err) {
                res.json({ "Error": err, "Message": "Error executing MySQL query" });
                return;
            }
	    else {
            console.log(rows);
            orders = [];

            rows.forEach(row => {
                orders.push(row.orderID);
            });
	    	
	    console.log(orders)
            res.json({
                "orders": orders
            });
        }
        });
        
    });




    function makeArray(w, h, val) {
        var arr = [];
        for(let i = 0; i < h; i++) {
            arr[i] = [];
            for(let j = 0; j < w; j++) {
                arr[i][j] = val;
            }
        }
        return arr;
    }
   
    




    async function insertPorts(posts) {
        for (let post of posts) {
            await connection.insert(post);
        }
    }

    /***************************************** test *****************************************************/

}
// The next line just makes this module available... think of it as a kind package statement in Java

module.exports = REST_ROUTER;
