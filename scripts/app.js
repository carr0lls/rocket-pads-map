var initialize = (function() {

	var CONFIG = {
		'DEBUG': false // Enable to use dummy data if API server is down
	}
	var API = {
		'ROCKET_PADS': 'https://launchlibrary.net/1.2/pad?mode=verbose',
		'ROCKETS': 'https://launchlibrary.net/1.2/rocket?mode=verbose'
	}
	var ROCKETPADS = {};
	var ROCKETS = {};
	var MAP;

	function fetchRocketPads(offset = 0) {
		return function(resolve, reject) {
			if (CONFIG.DEBUG)
				return resolve(SEED.dummy_pads);

			fetch(API.ROCKET_PADS + '&offset=' + offset)
				.then(function(response) {
					return response.json();
				})
				.then(function(data) {
					return resolve(data);
				}).
				catch(function(error) {
					var errorObject = { 
						reason: 'failed to retrieve rocket pads data',
						error: error
					}
					return reject(errorObject);
				});
		}
	}

	function fetchRockets(offset = 0) {
		return function(resolve, reject) {
			if (CONFIG.DEBUG)
				return resolve(SEED.dummy_rockets);

			fetch(API.ROCKETS + '&offset=' + offset)
				.then(function(response) {
					return response.json();
				})
				.then(function(data) {
					return resolve(data);
				}).
				catch(function(error) {
					var errorObject = { 
						reason: 'failed to retrieve rockets data',
						error: error
					}
					return reject(errorObject);
				});
		}
	}

	function initialFetch() {
		var promises = [];
		promises.push(new Promise(fetchRocketPads()));
		promises.push(new Promise(fetchRockets()));

		return Promise.all(promises);
	}

	// Fetch per page because API Rocket and Pad endpoints don't allow limits to be set off
	function fullFetch(data) {
		var rocketPadPromises = [], rocketPromises = [], combinedPromises = [];
		var rocketPadsData = data[0], rocketsData = data[1];
		var offset = 0; 

		while (offset < parseInt(rocketPadsData['total'])) {
			rocketPadPromises.push(new Promise(fetchRocketPads(offset)));
			offset += parseInt(rocketPadsData['count']);
		}

		offset = 0;
		while (offset < parseInt(rocketsData['total'])) {
			rocketPromises.push(new Promise(fetchRockets(offset)));
			offset += parseInt(rocketsData['count']);
		}

		combinedPromises.push(Promise.all(rocketPadPromises));
		combinedPromises.push(Promise.all(rocketPromises));

		return Promise.all(combinedPromises);
	}

	function mergeData(data) {
		var rocketPadsData = data[0], rocketsData = data[1];
		var padIds;

		// Build rocket pads look-up table
		rocketPadsData.map(function(data) {
			for (var rocketPad of data['pads']) {
				ROCKETPADS[rocketPad['id']] = rocketPad;
			}
		});
		// Build rockets look-up table
		rocketsData.map(function(data) {
			for (var rocket of data['rockets']) {
				ROCKETS[rocket['id']] = rocket;
				// Attach rocket id's to rocket pads look-up table
				if (rocket['defaultPads']) {
					padIds = rocket['defaultPads'].split(',');

					for (var pid of padIds) {
						if (ROCKETPADS[pid]) {
							if (ROCKETPADS[pid]['rockets'] === undefined)
								ROCKETPADS[pid]['rockets'] = [rocket['id']];
							else
								ROCKETPADS[pid]['rockets'].push(rocket['id']);
						}
					}
				}
			}
		});
	}

	function addMarkerToMap(padInfo, rocketInfo=false) {
		var marker, infoWindow, myLatlng, contentString = '';

		marker = new google.maps.Marker({
			map: MAP,
		    position: new google.maps.LatLng(padInfo['latitude'], padInfo['longitude']),
		    name: padInfo['name'],
		    rockets: rocketInfo
		});

		Object.entries(rocketInfo).forEach(function([key, rocket]) {
			if (rocket['imageURL']) {
				contentString += `
					<div>
						<a href="${rocket['wikiURL']}" target="_blank">
							${rocket['name']}
						</a>
						<div><img src="${rocket['imageURL']}" alt="${rocket['name']}" width="40px" /></div>
					</div>`;
			}
			else {
				contentString += `
					<div>
						<a href="${rocket['wikiURL']}" target="_blank">
							${rocket['name']}
						</a>
					</div>`;
			}
		});

		infoWindow = new google.maps.InfoWindow({
			content: `
				<div>
					<div>
						<a href="${padInfo['wikiURL']}" target="_blank"><h2>${padInfo['name']}</h2></a>
					</div>
					${contentString}
				</div>`
		});

		google.maps.event.addListener(marker, 'click', function() {
			infoWindow.open(MAP, marker);
		});		
	}

	function renderDataToMap() {
		var rocketInfo;
		
		Object.entries(ROCKETPADS).forEach(function([key, rpad]) {
			rocketInfo = {};
			if (rpad['rockets']) {
				for (var rid of rpad['rockets']) {
					rocketInfo[rid] = { 
						name: ROCKETS[rid]['name'], 
						imageURL: ROCKETS[rid]['imageURL'],
						wikiURL: ROCKETS[rid]['wikiURL']
					};
				}
			}
			addMarkerToMap(rpad, rocketInfo);
		});
	}

	function renderMap() {
		var mapOptions = {
		  zoom: 2,
		  center: new google.maps.LatLng(25.6579032, -8.1180046)
		}
		MAP = new google.maps.Map(document.getElementById("map"), mapOptions);
	}

	function init() {
		renderMap();

		initialFetch()
			.then(fullFetch)
			.then(mergeData)
			.then(renderDataToMap)
			.catch(function(error) { console.log(error); });
	}

	return init;

})();