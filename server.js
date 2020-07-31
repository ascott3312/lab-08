'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');	
const superagent = require('superagent');
const cors = require('cors');
const pg = require('pg');

// Application Setup
const app = express();
app.use(cors());
const PORT = process.env.PORT;
if(!process.env.DATABASE_URL) {
  throw new Error('Missing database URL.');
}
const client = new pg.Client(process.env.DATABASE_URL);
client.on('error', err => { throw err; });

// NEW CODE: CACHE the Locations!
const locations = {};

// Route Definitions
app.get('/location', locationHandler);
app.get('/restaurants', restaurantHandler);
app.get('/places', placesHandler);
app.use('*', notFoundHandler);


function locationHandler(request, response) {
  const city = request.query.city;
  const url = 'https://us1.locationiq.com/v1/search.php';

  // If we already got data for this city, don't fetch it again
  if (locations[city]) {
    response.send(locations[city]);
  }
  else {

    const queryParams = {
      key: process.env.GEOCODE_API_KEY,
      q: city,
      format: 'json',
      limit: 1,
    };
    superagent.get(url)
      .query(queryParams)
      .then(data => {
        const geoData = data.body[0]; // first one ...
        const location = new Location(city, geoData);
        locations[city] = location; // Save it for next time
        response.send(location);
      })
      .catch((error) => {
        console.log('ERROR', error);
        response.status(500).send('So sorry, something went wrong.');
      });
  }
}

function Location(city, geoData) {
  this.search_query = city;
  this.formatted_query = geoData.display_name;
  this.latitude = geoData.lat;
  this.longitude = geoData.lon;
}

function restaurantHandler(request, response) {

  const url = 'https://developers.zomato.com/api/v2.1/geocode';

  const queryParams = {
    lat: request.query.latitude,
    lng: request.query.longitude,
  };

  superagent.get(url)
    .set('user-key', process.env.ZOMATO_API_KEY)
    .query(queryParams)
    .then((data) => {
      const results = data.body;
      const restaurantData = [];
      results.nearby_restaurants.forEach(entry => {
        restaurantData.push(new Restaurant(entry));
      });
      response.send(restaurantData);
    })
    .catch((error) => {
      console.error(error);
      response.status(500).send('sorry, something went wrong');
    });

}

function Restaurant(entry) {
  this.restaurant = entry.restaurant.name;
  this.cuisines = entry.restaurant.cuisines;
  this.locality = entry.restaurant.location.locality;
}

function placesHandler(request, response) {

  const lat = request.query.latitude;
  const lng = request.query.longitude;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;

  const queryParams = {
    access_token: process.env.MAPBOX_API_KEY,
    types: 'poi',
    limit: 10,
  };

  superagent.get(url)
    .query(queryParams)
    .then((data) => {
      const results = data.body;
      const places = [];
      results.features.forEach(entry => {
        places.push(new Place(entry));
      });
      response.send(places);
    })
    .catch((error) => {
      console.error(error);
      response.status(500).send('sorry, something went wrong');
    });
}

function Place(data) {
  this.name = data.text;
  this.type = data.properties.category;
  this.address = data.place_name;
}
function notFoundHandler(request, response) {
  response.status(404).send('huh?');
}
// Make sure the server is listening for requests
client.connect()
  .then(() => {
    console.log('Postgres connected.');
    app.listen(PORT,() => console.log(`Listening on port ${PORT}`));
  })
  .catch(err => {
    throw `Postgres error: ${err.message}`;
  });
  
//© 2020 GitHub, Inc.
// Terms
// Privacy
// Security
// Status
// Help
// Contact GitHub
// Pricing
// API
// Training
// Blog
// About
