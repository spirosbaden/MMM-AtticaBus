var NodeHelper = require("node_helper");
var https = require("https");

module.exports = NodeHelper.create({

    lineCache: null,

    // Πόσες κοντινές στάσεις θα εξετάζουμε όταν
    // δεν υπάρχει λεωφορείο στην αρχική στάση.
    fallbackStopCount: 8,


    socketNotificationReceived: function(notification, payload) {

        if (notification !== "GET_BUS_DATA") {
            return;
        }

        var self = this;

        if (!payload ||
            !Array.isArray(payload) ||
            payload.length === 0) {

            self.sendSocketNotification(
                "BUS_DATA_RESULT",
                "Δεν έχουν οριστεί στάσεις."
            );

            return;
        }

        /*
         * Παίρνουμε τη λίστα των γραμμών μόνο μία φορά.
         */
        self.getLines(function(lines) {

            if (!lines) {

                self.sendSocketNotification(
                    "BUS_DATA_RESULT",
                    "Αδυναμία λήψης στοιχείων γραμμών ΟΑΣΑ."
                );

                return;
            }

            self.processStations(
                payload,
                lines
            );
        });
    },


    // ============================================================
    // OASA LINES
    // ============================================================

    getLines: function(callback) {

        var self = this;

        if (self.lineCache) {
            callback(self.lineCache);
            return;
        }

        var url =
            "https://telematics.oasa.gr/api/?act=webGetLinesWithMLInfo";

        console.log(
            "[MMM-AtticaBus] Loading OASA line information..."
        );

        https.get(url, function(res) {

            var rawData = "";

            if (res.statusCode !== 200) {

                console.error(
                    "[MMM-AtticaBus] Lines HTTP status: " +
                    res.statusCode
                );

                res.resume();
                callback(null);
                return;
            }

            res.on("data", function(chunk) {
                rawData += chunk;
            });

            res.on("end", function() {

                try {

                    var data = JSON.parse(rawData);

                    if (!Array.isArray(data)) {

                        console.error(
                            "[MMM-AtticaBus] Invalid lines response."
                        );

                        callback(null);
                        return;
                    }

                    self.lineCache = data;

                    console.log(
                        "[MMM-AtticaBus] Loaded " +
                        data.length +
                        " line records."
                    );

                    callback(data);

                } catch (e) {

                    console.error(
                        "[MMM-AtticaBus] Lines parse error:",
                        e
                    );

                    callback(null);
                }
            });

        }).on("error", function(err) {

            console.error(
                "[MMM-AtticaBus] Lines HTTPS error:",
                err
            );

            callback(null);
        });
    },


    // ============================================================
    // PROCESS STATIONS
    // ============================================================

    processStations: function(
        stationsConfig,
        lines
    ) {

        var self = this;

        var results = [];
        var completed = 0;

        stationsConfig.forEach(function(target) {

            self.getStationData(
                target,
                lines,
                function(result) {

                    results.push(result);

                    completed++;

                    if (completed === stationsConfig.length) {

                        self.sendSocketNotification(
                            "BUS_DATA_RESULT",
                            results.join("<br>")
                        );
                    }
                }
            );
        });
    },


    // ============================================================
    // STATION
    // ============================================================

    getStationData: function(
        target,
        lines,
        callback
    ) {

        var self = this;

        var stationTitle =
            target.title ||
            ("Στάση " + target.stopId);

        var stationResult =
            "<strong>" +
            stationTitle +
            "</strong><br>";

        if (!target.stopId) {

            callback(
                stationResult +
                "&nbsp;&nbsp;<em>" +
                "Δεν έχει οριστεί stopId" +
                "</em>"
            );

            return;
        }

        /*
         * --------------------------------------------------------
         * Περίπτωση buses: []
         *
         * Δεν χρειάζεται route mapping.
         * --------------------------------------------------------
         */

        if (!target.buses ||
            !Array.isArray(target.buses) ||
            target.buses.length === 0) {

            self.getStopArrivals(
                target.stopId,
                function(arrivals) {

                    if (arrivals === null) {

                        callback(
                            stationResult +
                            "&nbsp;&nbsp;<em>" +
                            "Αδυναμία σύνδεσης με ΟΑΣΑ" +
                            "</em>"
                        );

                        return;
                    }

                    /*
                     * Υπάρχουν λεωφορεία στην κανονική στάση.
                     */
                    if (arrivals.length > 0) {

                        callback(
                            self.formatAllArrivals(
                                stationResult,
                                arrivals
                            )
                        );

                        return;
                    }

                    /*
                     * Δεν υπάρχει τίποτα στην κανονική στάση.
                     * Ψάχνουμε κοντινές.
                     */
                    self.findNearbyArrivals(
                        target.stopId,
                        null,
                        function(nearbyResult) {

                            if (nearbyResult) {

                                callback(
                                    self.formatAllArrivals(
                                        stationResult,
                                        nearbyResult.arrivals,
                                        nearbyResult.stop
                                    )
                                );

                                return;
                            }

                            callback(
                                stationResult +
                                "&nbsp;&nbsp;<em>" +
                                "Χωρίς ενεργά δρομολόγια τώρα" +
                                "</em>"
                            );
                        }
                    );
                }
            );

            return;
        }


        /*
         * --------------------------------------------------------
         * Έχουμε συγκεκριμένες γραμμές.
         *
         * Π.χ.
         * buses: ["021", "550"]
         * --------------------------------------------------------
         */

        self.getRequestedRoutes(
            target.buses,
            lines,
            function(routeMap) {

                /*
                 * Πρώτα ελέγχουμε την κανονική στάση.
                 */
                self.getStopArrivals(
                    target.stopId,
                    function(arrivals) {

                        if (arrivals === null) {

                            callback(
                                stationResult +
                                "&nbsp;&nbsp;<em>" +
                                "Αδυναμία σύνδεσης με ΟΑΣΑ" +
                                "</em>"
                            );

                            return;
                        }

                        var selected =
                            self.selectArrivals(
                                arrivals,
                                routeMap
                            );

                        /*
                         * ------------------------------------------------
                         * ΒΡΕΘΗΚΕ ΣΤΗΝ ΚΑΝΟΝΙΚΗ ΣΤΑΣΗ
                         * ------------------------------------------------
                         */
                        if (selected.length > 0) {

                            callback(
                                self.formatFilteredArrivals(
                                    stationResult,
                                    selected,
                                    target.buses
                                )
                            );

                            return;
                        }

                        /*
                         * ------------------------------------------------
                         * ΔΕΝ ΒΡΕΘΗΚΕ.
                         *
                         * Ψάχνουμε τις κοντινότερες στάσεις.
                         * ------------------------------------------------
                         */

                        console.log(
                            "[MMM-AtticaBus] No requested bus at stop " +
                            target.stopId +
                            ". Searching nearby stops..."
                        );

                        self.findNearbyArrivals(
                            target.stopId,
                            routeMap,
                            function(nearbyResult) {

                                if (nearbyResult) {

                                    callback(
                                        self.formatFilteredArrivals(
                                            stationResult,
                                            nearbyResult.arrivals,
                                            target.buses,
                                            nearbyResult.stop
                                        )
                                    );

                                    return;
                                }

                                callback(
                                    self.formatFilteredArrivals(
                                        stationResult,
                                        [],
                                        target.buses
                                    )
                                );
                            }
                        );
                    }
                );
            }
        );
    },


    // ============================================================
    // SELECT ARRIVALS FROM ROUTE MAP
    // ============================================================

    selectArrivals: function(
        arrivals,
        routeMap
    ) {

        var selected = [];

        if (!arrivals ||
            !Array.isArray(arrivals)) {

            return selected;
        }

        arrivals.forEach(function(bus) {

            var routeCode =
                String(
                    bus.route_code || ""
                );

            if (routeMap[routeCode]) {

                selected.push({
                    bus: bus,
                    lineId: routeMap[routeCode]
                });
            }
        });

        return selected;
    },


    // ============================================================
    // FIND NEARBY ARRIVALS
    // ============================================================

    findNearbyArrivals: function(
		stopId,
		routeMap,
		callback
	) {

		var self = this;

		/*
		 * Αν έχουμε συγκεκριμένες γραμμές,
		 * ψάχνουμε ΜΟΝΟ στα stops των αντίστοιχων routes.
		 */
		if (routeMap &&
			Object.keys(routeMap).length > 0) {

			self.getStopCoordinates(
				stopId,
				function(coordinates) {

					if (!coordinates) {
						callback(null);
						return;
					}

					var routeCodes =
						Object.keys(routeMap);

					var allStops = [];
					var processedRoutes = 0;

					routeCodes.forEach(function(routeCode) {

						self.getRouteStops(
							routeCode,
							function(stops) {

								if (stops &&
									Array.isArray(stops)) {

									stops.forEach(function(stop) {

										/*
										 * Αποφεύγουμε διπλά stops
										 * που μπορεί να εμφανίζονται
										 * σε περισσότερα routes.
										 */
										var stopCode =
											String(
												stop.StopCode ||
												stop.stop_code ||
												stop.stopId ||
												""
											);

										if (!stopCode) {
											return;
										}

										var alreadyExists =
											allStops.some(
												function(existing) {

													return String(
														existing.StopCode ||
														existing.stop_code ||
														existing.stopId ||
														""
													) === stopCode;
												}
											);

										if (!alreadyExists) {
											allStops.push(stop);
										}
									});
								}

								processedRoutes++;

								if (processedRoutes === routeCodes.length) {

									/*
									 * Υπολογίζουμε απόσταση από
									 * το αρχικό stop.
									 */
									allStops.forEach(function(stop) {

										var lat = parseFloat(
											stop.StopLat ||
											stop.stop_lat
										);

										var lng = parseFloat(
											stop.StopLng ||
											stop.stop_lng
										);

										if (isNaN(lat) ||
											isNaN(lng)) {

											stop._distance = 999999;
											return;
										}

										var dLat =
											lat -
											coordinates.lat;

										var dLng =
											lng -
											coordinates.lng;

										/*
										 * Προσεγγιστική απόσταση
										 * σε μέτρα.
										 */
										var x =
											dLng *
											111320 *
											Math.cos(
												coordinates.lat *
												Math.PI / 180
											);

										var y =
											dLat *
											110540;

										stop._distance =
											Math.sqrt(
												x * x +
												y * y
											);
									});

									/*
									 * Κοντινότερο πρώτα.
									 */
									allStops.sort(
										function(a, b) {

											return (
												a._distance -
												b._distance
											);
										}
									);

									self.checkNearbyRouteStops(
										allStops,
										0,
										routeMap,
										function(result) {

											callback(result);
										}
									);
								}
							}
						);
					});
				}
			);

			return;
		}

		/*
		 * Αν buses: [] δεν έχουμε συγκεκριμένη γραμμή.
		 *
		 * Εδώ κρατάμε το παλιό generic fallback:
		 * βρίσκουμε τα κοντινότερα stops.
		 */
		self.getStopCoordinates(
			stopId,
			function(coordinates) {

				if (!coordinates) {
					callback(null);
					return;
				}

				self.getClosestStops(
					coordinates.lng,
					coordinates.lat,
					function(stops) {

						if (!stops ||
							stops.length === 0) {

							callback(null);
							return;
						}

						self.checkNearbyRouteStops(
							stops,
							0,
							null,
							function(result) {

								callback(result);
							}
						);
					}
				);
			}
		);
	},
	
	checkNearbyRouteStops: function(
		stops,
		index,
		routeMap,
		callback
	) {

		var self = this;

		if (!stops ||
			index >= stops.length) {

			callback(null);
			return;
		}

		var stop = stops[index];

		var stopId =
			String(
				stop.StopCode ||
				stop.stop_code ||
				stop.stopId ||
				""
			);

		if (!stopId) {

			self.checkNearbyRouteStops(
				stops,
				index + 1,
				routeMap,
				callback
			);

			return;
		}

		var stopName =
			stop.StopDescr ||
			stop.stop_descr ||
			stop.stopName ||
			"";

		var distance =
			stop._distance !== undefined
				? stop._distance
				: parseFloat(stop.distance || 0);

		console.log(
			"[MMM-AtticaBus] Checking nearby stop " +
			stopId +
			" (" +
			stopName +
			"), distance=" +
			distance
		);

		self.getStopArrivals(
			stopId,
			function(arrivals) {

				if (arrivals &&
					arrivals.length > 0) {

					/*
					 * Αν έχουμε routeMap, κρατάμε
					 * μόνο τα routes της ζητούμενης γραμμής.
					 */
					var selected = [];

					if (routeMap) {

						arrivals.forEach(function(bus) {

							var routeCode =
								String(
									bus.route_code || ""
								);

							if (routeMap[routeCode]) {

								selected.push({
									bus: bus,
									lineId: routeMap[routeCode]
								});
							}
						});

					} else {

						/*
						 * buses: []
						 * Όλα τα arrivals είναι αποδεκτά.
						 */
						selected = arrivals;
					}

					if (selected.length > 0) {

						console.log(
							"[MMM-AtticaBus] Found requested bus at nearby stop " +
							stopId
						);

						callback({
							stopId: stopId,
							stopName: stopName,
							distance: distance,
							arrivals: selected
						});

						return;
					}
				}

				/*
				 * Δεν βρήκαμε το ζητούμενο route.
				 * Πάμε στο αμέσως επόμενο κοντινότερο stop.
				 */
				self.checkNearbyRouteStops(
					stops,
					index + 1,
					routeMap,
					callback
				);
			}
		);
	},


    // ============================================================
    // CHECK NEARBY STOPS ONE BY ONE
    // ============================================================

    checkNearbyStop: function(
        stops,
        index,
        originalStopId,
        routeMap,
        callback
    ) {

        var self = this;

        if (!stops ||
            index >= stops.length) {

            callback(null);
            return;
        }

        var stop = stops[index];

        if (!stop ||
            !stop.StopCode) {

            self.checkNearbyStop(
                stops,
                index + 1,
                originalStopId,
                routeMap,
                callback
            );

            return;
        }

        var nearbyStopId =
            String(stop.StopCode);

        /*
         * Μην ξαναελέγξουμε την αρχική στάση.
         */
        if (nearbyStopId === String(originalStopId)) {

            self.checkNearbyStop(
                stops,
                index + 1,
                originalStopId,
                routeMap,
                callback
            );

            return;
        }

        console.log(
            "[MMM-AtticaBus] Checking nearby stop " +
            nearbyStopId +
            " (" +
            (stop.StopDescr || "") +
            "), distance=" +
            (stop.distance || "") 
        );

        self.getStopArrivals(
            nearbyStopId,
            function(arrivals) {

                /*
                 * Αν το API απέτυχε για αυτή τη στάση,
                 * συνεχίζουμε στην επόμενη.
                 */
                if (arrivals === null) {

                    self.checkNearbyStop(
                        stops,
                        index + 1,
                        originalStopId,
                        routeMap,
                        callback
                    );

                    return;
                }

                var selected;

                /*
                 * routeMap == null σημαίνει:
                 * buses: []
                 *
                 * Άρα μας ενδιαφέρει οποιοδήποτε λεωφορείο.
                 */
                if (!routeMap) {

                    selected = arrivals;

                } else {

                    selected =
                        self.selectArrivals(
                            arrivals,
                            routeMap
                        );
                }

                if (selected &&
                    selected.length > 0) {

                    console.log(
                        "[MMM-AtticaBus] Found bus at nearby stop " +
                        nearbyStopId +
                        " (" +
                        (stop.StopDescr || "") +
                        ")"
                    );

                    callback({
                        arrivals: selected,
                        stop: stop
                    });

                    return;
                }

                /*
                 * Δεν βρέθηκε στην τρέχουσα κοντινή στάση.
                 * Πάμε στην επόμενη.
                 */
                self.checkNearbyStop(
                    stops,
                    index + 1,
                    originalStopId,
                    routeMap,
                    callback
                );
            }
        );
    },


    // ============================================================
    // GET STOP COORDINATES
    // ============================================================

    getStopCoordinates: function(
        stopId,
        callback
    ) {

        var url =
            "https://telematics.oasa.gr/api/?act=getStopNameAndXY&p1=" +
            encodeURIComponent(stopId);

        console.log(
            "[MMM-AtticaBus] Requesting coordinates: " +
            stopId
        );

        https.get(url, function(res) {

            var rawData = "";

            if (res.statusCode !== 200) {

                console.error(
                    "[MMM-AtticaBus] Coordinates HTTP status: " +
                    res.statusCode
                );

                res.resume();
                callback(null);
                return;
            }

            res.on("data", function(chunk) {
                rawData += chunk;
            });

            res.on("end", function() {

                try {

                    if (!rawData ||
                        rawData.trim() === "") {

                        callback(null);
                        return;
                    }

                    var data =
                        JSON.parse(rawData);

                    if (!Array.isArray(data) ||
                        data.length === 0) {

                        callback(null);
                        return;
                    }

                    var stop = data[0];

                    /*
                     * ΠΡΟΣΟΧΗ:
                     * Το OASA endpoint επιστρέφει:
                     *
                     * stop_lat
                     * stop_lng
                     */
                    var lat =
                        parseFloat(
                            stop.stop_lat
                        );

                    var lng =
                        parseFloat(
                            stop.stop_lng
                        );

                    if (isNaN(lat) ||
                        isNaN(lng)) {

                        console.error(
                            "[MMM-AtticaBus] Invalid coordinates response: " +
                            rawData
                        );

                        callback(null);
                        return;
                    }

                    callback({
                        lat: lat,
                        lng: lng
                    });

                } catch (e) {

                    console.error(
                        "[MMM-AtticaBus] Coordinates parse error:",
                        e
                    );

                    console.error(
                        "[MMM-AtticaBus] Raw coordinates response:",
                        rawData
                    );

                    callback(null);
                }
            });

        }).on("error", function(err) {

            console.error(
                "[MMM-AtticaBus] Coordinates HTTPS error:",
                err
            );

            callback(null);
        });
    },


    // ============================================================
    // GET CLOSEST STOPS
    // ============================================================

    getClosestStops: function(
        longitude,
        latitude,
        callback
    ) {

        var url =
            "https://telematics.oasa.gr/api/?act=getClosestStops&p1=" +
            encodeURIComponent(longitude) +
            "&p2=" +
            encodeURIComponent(latitude);

        console.log(
            "[MMM-AtticaBus] Requesting closest stops: " +
            longitude +
            ", " +
            latitude
        );

        https.get(url, function(res) {

            var rawData = "";

            if (res.statusCode !== 200) {

                console.error(
                    "[MMM-AtticaBus] Closest stops HTTP status: " +
                    res.statusCode
                );

                res.resume();
                callback([]);
                return;
            }

            res.on("data", function(chunk) {
                rawData += chunk;
            });

            res.on("end", function() {

                try {

                    if (!rawData ||
                        rawData.trim() === "") {

                        callback([]);
                        return;
                    }

                    var data =
                        JSON.parse(rawData);

                    if (!Array.isArray(data)) {

                        console.error(
                            "[MMM-AtticaBus] Invalid closest stops response."
                        );

                        callback([]);
                        return;
                    }

                    console.log(
                        "[MMM-AtticaBus] Closest stops found: " +
                        data.length
                    );

                    callback(data);

                } catch (e) {

                    console.error(
                        "[MMM-AtticaBus] Closest stops parse error:",
                        e
                    );

                    console.error(
                        "[MMM-AtticaBus] Raw closest stops response:",
                        rawData
                    );

                    callback([]);
                }
            });

        }).on("error", function(err) {

            console.error(
                "[MMM-AtticaBus] Closest stops HTTPS error:",
                err
            );

            callback([]);
        });
    },


    // ============================================================
    // FIND ROUTES FOR REQUESTED BUS LINES
    // ============================================================

    getRequestedRoutes: function(
        requestedBuses,
        lines,
        callback
    ) {

        var self = this;

        var routeMap = {};

        if (!requestedBuses ||
            requestedBuses.length === 0) {

            callback(routeMap);
            return;
        }

        var processed = 0;

        requestedBuses.forEach(function(busNumber) {

            var requestedLine =
                String(busNumber)
                    .trim()
                    .toUpperCase();

            var matchingLines = lines.filter(
                function(line) {

                    return String(
                        line.line_id || ""
                    )
                    .trim()
                    .toUpperCase() ===
                    requestedLine;
                }
            );

            if (matchingLines.length === 0) {

                console.warn(
                    "[MMM-AtticaBus] Line not found: " +
                    busNumber
                );

                processed++;

                if (processed === requestedBuses.length) {
                    callback(routeMap);
                }

                return;
            }

            /*
             * Κρατάμε την υπάρχουσα λογική:
             * προτιμάμε το master record.
             */
            var masterLine = matchingLines.find(
                function(line) {

                    return String(
                        line.mld_master || ""
                    ) === "1";
                }
            );

            var selectedLine =
                masterLine || matchingLines[0];

            var lineCode =
                selectedLine.line_code;

            console.log(
                "[MMM-AtticaBus] " +
                busNumber +
                " -> line_code " +
                lineCode
            );

            self.getRoutesForLine(
                lineCode,
                function(routes) {

                    if (routes &&
                        Array.isArray(routes)) {

                        routes.forEach(
                            function(route) {

                                if (!route.route_code) {
                                    return;
                                }

                                var routeCode =
                                    String(
                                        route.route_code
                                    );

                                routeMap[routeCode] =
                                    requestedLine;
                            }
                        );
                    }

                    processed++;

                    if (processed === requestedBuses.length) {

                        console.log(
                            "[MMM-AtticaBus] Route map: " +
                            JSON.stringify(routeMap)
                        );

                        callback(routeMap);
                    }
                }
            );
        });
    },


    // ============================================================
    // GET ROUTES FOR LINE
    // ============================================================

    getRoutesForLine: function(
        lineCode,
        callback
    ) {

        var url =
            "https://telematics.oasa.gr/api/?act=getRoutesForLine&p1=" +
            encodeURIComponent(lineCode);

        console.log(
            "[MMM-AtticaBus] Requesting routes for line_code: " +
            lineCode
        );

        https.get(url, function(res) {

            var rawData = "";

            if (res.statusCode !== 200) {

                console.error(
                    "[MMM-AtticaBus] Routes HTTP status: " +
                    res.statusCode
                );

                res.resume();
                callback([]);
                return;
            }

            res.on("data", function(chunk) {
                rawData += chunk;
            });

            res.on("end", function() {

                try {

                    if (!rawData ||
                        rawData.trim() === "") {

                        callback([]);
                        return;
                    }

                    var data = JSON.parse(rawData);

                    if (!Array.isArray(data)) {

                        callback([]);
                        return;
                    }

                    callback(data);

                } catch (e) {

                    console.error(
                        "[MMM-AtticaBus] Routes parse error:",
                        e
                    );

                    console.error(
                        "[MMM-AtticaBus] Raw routes response:",
                        rawData
                    );

                    callback([]);
                }
            });

        }).on("error", function(err) {

            console.error(
                "[MMM-AtticaBus] Routes HTTPS error:",
                err
            );

            callback([]);
        });
    },


    // ============================================================
    // GET STOP ARRIVALS
    // ============================================================

    getStopArrivals: function(
        stopId,
        callback
    ) {

        var url =
            "https://telematics.oasa.gr/api/?act=getStopArrivals&p1=" +
            encodeURIComponent(stopId);

        console.log(
            "[MMM-AtticaBus] Requesting arrivals: " +
            stopId
        );

        https.get(url, function(res) {

            var rawData = "";

            if (res.statusCode !== 200) {

                console.error(
                    "[MMM-AtticaBus] Arrivals HTTP status: " +
                    res.statusCode
                );

                res.resume();
                callback(null);
                return;
            }

            res.on("data", function(chunk) {
                rawData += chunk;
            });

            res.on("end", function() {

                try {

                    if (!rawData ||
                        rawData.trim() === "") {

                        callback([]);
                        return;
                    }

                    var data = JSON.parse(rawData);

                    if (!Array.isArray(data)) {

                        callback([]);
                        return;
                    }

                    console.log(
                        "[MMM-AtticaBus] " +
                        stopId +
                        " arrivals: " +
                        JSON.stringify(data)
                    );

                    callback(data);

                } catch (e) {

                    console.error(
                        "[MMM-AtticaBus] Arrivals parse error:",
                        e
                    );

                    console.error(
                        "[MMM-AtticaBus] Raw response:",
                        rawData
                    );

                    callback(null);
                }
            });

        }).on("error", function(err) {

            console.error(
                "[MMM-AtticaBus] Arrivals HTTPS error:",
                err
            );

            callback(null);
        });
    },


    // ============================================================
    // FORMAT ALL ARRIVALS
    // ============================================================

    formatAllArrivals: function(
        stationResult,
        arrivals,
        nearbyStop
    ) {

        if (!arrivals ||
            arrivals.length === 0) {

            return stationResult +
                "&nbsp;&nbsp;<em>" +
                "Χωρίς ενεργά δρομολόγια τώρα" +
                "</em>";
        }

        arrivals.sort(function(a, b) {

            return parseInt(
                a.btime2 || "999",
                10
            ) -
            parseInt(
                b.btime2 || "999",
                10
            );
        });

        arrivals.forEach(function(bus) {

            stationResult +=
                "&nbsp;&nbsp;• " +
                "Δρομολόγιο " +
                (bus.route_code || "-") +
                ": σε " +
                (bus.btime2 || "-") +
                "'<br>";
        });

        /*
         * Αν βρέθηκε σε κοντινή στάση,
         * το αναφέρουμε.
         */
        if (nearbyStop) {

            stationResult +=
                "&nbsp;&nbsp;<small>" +
                "↳ " +
                (nearbyStop.StopDescr || "") +
                " (" +
                this.formatDistance(
                    nearbyStop.distance
                ) +
                ")" +
                "</small><br>";
        }

        return stationResult;
    },


    // ============================================================
    // FORMAT FILTERED ARRIVALS
    // ============================================================

    formatFilteredArrivals: function(
        stationResult,
        selected,
        requestedBuses,
        nearbyStop
    ) {

        if (!selected ||
            selected.length === 0) {

            stationResult +=
                "&nbsp;&nbsp;<em>" +
                "Δεν υπάρχει διαθέσιμο λεωφορείο αυτή τη στιγμή" +
                "</em>";

            return stationResult;
        }

        selected.sort(function(a, b) {

            var timeA =
                parseInt(
                    a.bus ?
                    a.bus.btime2 :
                    a.btime2 || "999",
                    10
                );

            var timeB =
                parseInt(
                    b.bus ?
                    b.bus.btime2 :
                    b.btime2 || "999",
                    10
                );

            return timeA - timeB;
        });

        selected.forEach(function(item) {

            var bus =
                item.bus || item;

            var lineId =
                item.lineId ||
                "-";

            var arrival =
                bus.btime2 ||
                "-";

            stationResult +=
                "&nbsp;&nbsp;• " +
                lineId +
                ": σε " +
                arrival +
                "'<br>";
        });

        /*
         * Αν χρειάστηκε fallback,
         * δείχνουμε από ποια κοντινή στάση βρέθηκε.
         */
        if (nearbyStop) {

            stationResult +=
                "&nbsp;&nbsp;<small>" +
                "↳ " +
                (nearbyStop.StopDescr || "") +
                " (" +
                this.formatDistance(
                    nearbyStop.distance
                ) +
                ")" +
                "</small><br>";
        }

        return stationResult;
    },

	getRouteStops: function(routeCode, callback) {

		var url =
			"https://telematics.oasa.gr/api/?act=webGetStops&p1=" +
			encodeURIComponent(routeCode);

		console.log(
			"[MMM-AtticaBus] Requesting stops for route: " +
			routeCode
		);

		https.get(url, function(res) {

			var rawData = "";

			if (res.statusCode !== 200) {

				console.error(
					"[MMM-AtticaBus] Route stops HTTP status: " +
					res.statusCode
				);

				res.resume();
				callback([]);
				return;
			}

			res.on("data", function(chunk) {
				rawData += chunk;
			});

			res.on("end", function() {

				try {

					if (!rawData ||
						rawData.trim() === "") {

						callback([]);
						return;
					}

					var data = JSON.parse(rawData);

					if (!Array.isArray(data)) {
						callback([]);
						return;
					}

					callback(data);

				} catch (e) {

					console.error(
						"[MMM-AtticaBus] Route stops parse error:",
						e
					);

					console.error(
						"[MMM-AtticaBus] Raw route stops response:",
						rawData
					);

					callback([]);
				}
			});

		}).on("error", function(err) {

			console.error(
				"[MMM-AtticaBus] Route stops HTTPS error:",
				err
			);

			callback([]);
		});
	},

    // ============================================================
    // FORMAT DISTANCE
    // ============================================================

    formatDistance: function(distance) {

        var value =
            parseFloat(distance);

        if (isNaN(value)) {
            return "?";
        }

        /*
         * Το distance του OASA είναι σε μοίρες.
         * Για την εμφάνιση κάνουμε προσεγγιστική
         * μετατροπή σε μέτρα.
         */
        var meters =
            value * 111000;

        if (meters < 1000) {

            return Math.round(meters) + " m";

        }

        return (
            meters / 1000
        ).toFixed(1) + " km";
    }

});