import OpenAI from "openai";
import mysql from "mysql2/promise";
import {promises as fs} from 'fs';
import { userValues, reviewValues, movieValues } from "./exampleValues.js";

process.loadEnvFile();

const db_connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: "movies"
});

async function init_db() {
    await db_connection.beginTransaction();
    await db_connection.query(`DROP TABLE reviews;`);
    await db_connection.query(`DROP TABLE users;`);
    await db_connection.query(`DROP TABLE movies;`);

    try {
        await db_connection.query(CREATE_MOVIES);
        await db_connection.query(CREATE_USERS);
        await db_connection.query(CREATE_REVIEWS);

        const insert_sql = (table, cols) => `
            INSERT INTO ${table} (${cols})
            VALUES ?
            `;    
        await db_connection.query(insert_sql('users', 'username, email'), [userValues]);

        await db_connection.query(insert_sql('movies', 'title, genre, release_year'), [movieValues]);

        await db_connection.query(insert_sql('reviews', 'user_id, movie_id, rating, comment'), [reviewValues]);
        
        await db_connection.commit();
    } catch (err) {
        db_connection.rollback();
        console.log("Error in creating tables");
    }
}

const CREATE_MOVIES = `CREATE TABLE movies (
  movie_id int NOT NULL AUTO_INCREMENT,
  title varchar(150) NOT NULL,
  genre varchar(50) DEFAULT NULL,
  release_year int DEFAULT NULL,
  PRIMARY KEY (movie_id)
);`
const CREATE_USERS = `CREATE TABLE users (
  user_id int NOT NULL AUTO_INCREMENT,
  username varchar(50) UNIQUE NOT NULL,
  email varchar(100) UNIQUE NOT NULL,
  PRIMARY KEY (user_id)
);`
const CREATE_REVIEWS = `CREATE TABLE reviews (
  review_id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  movie_id int NOT NULL,
  rating int DEFAULT NULL,
  comment text,
  review_date datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  UNIQUE (user_id,movie_id),
  FOREIGN KEY (user_id) REFERENCES users (user_id),
  FOREIGN KEY (movie_id) REFERENCES movies (movie_id),
  CONSTRAINT reviews_values CHECK ((rating between 1 and 5))
);`

await init_db();

const openAIClient = new OpenAI();

let questions = [
    "Which movies have the highest average rating?",
    "Which movies have been reviewed by multiple users?",
    "Which users have reviewed multiple movies?",
    "What are the top 3 most reviewed genres?",
    "What are the titles and release years of movies that have reviews?",
    "Which users have given more than one 5-star rating?",
    "Which users have never written a review?",
    "Are there any highly rated movies that only have a single review?"
];

const setupSqlScript = CREATE_MOVIES + CREATE_USERS + CREATE_REVIEWS;
const sqlOnlyRequest = " Give me a mysql select statement that answers the following question. Only respond with mysql syntax. If there is an error do not explain it!"
const strategies = {
  zero_shot:  CREATE_MOVIES + CREATE_USERS + CREATE_REVIEWS + sqlOnlyRequest,
  single_example:
    setupSqlScript +
    " Example Question: Which movies have recieved at least one review with a rating of 1? " +
    " \nExample Response: SELECT DISTINCT m.title\nFROM movies m\nLEFT JOIN reviews r ON m.movie_id = r.movie_id \nWHERE r.rating = 1;\n " +
    sqlOnlyRequest,
  double_example:
    setupSqlScript +
    " Example Question: Which movies have recieved at least one review with a rating of 1? " +
    " \nExample Response: SELECT DISTINCT m.title\nFROM movies m\nLEFT JOIN reviews r ON m.movie_id = r.movie_id \nWHERE r.rating = 1;\n " +
    " Example Question: Which users have reviewed Inception? " +
    " \nExample Response: SELECT u.username\nFROM users u\nLEFT JOIN reviews r ON u.user_id = r.user_id\nLEFT JOIN movies m ON r.movie_id = m.movie_id\nWHERE m.title='Inception';\n " +
    sqlOnlyRequest
};

async function getAIResponse(prompt) {
  return "placeholder response";
  const response = await client.responses.create({
    model: "gpt-4o-nano",
    input: prompt
  });
  return response;
}

function sanitizeForSql(str) {
  return str;
}

for (const strategy in strategies) {
  
  const currFile = 'responses/' + strategy + '.txt';
  await fs.writeFile(currFile, 'Attempting Strategy: ' + strategy + '\n');
  await fs.appendFile(currFile, 'Prompt Prefix: ' + strategies[strategy]);
  
  for (const i in  questions) {
    const sqlResponse = await getAIResponse(strategies[strategy] + questions[i]);
    sanitizeForSql(sqlResponse);
    await fs.appendFile(currFile, '\n\nQuestion: ' + questions[i] + '\nSql Response: ' + sqlResponse+ '\n');

    let data;
    try {
      data = await db_connection.query(sqlResponse);
    } catch (err) {
      fs.appendFile(currFile, '\nERROR\nQuery Failed\n');
      await fs.appendFile(currFile, '\n------------------------------------\n');
      continue;
    }

    const finalResponse = await getAIResponse('Given the question "' + questions[i] + '" and the related raw data ' + data + 'give a friendly and concise answer to the question. Please do not give any other suggests or chatter.');

    await fs.appendFile(currFile, '\nFinal Response: ' + finalResponse);
    await fs.appendFile(currFile, '\n------------------------------------\n');
  }
  
}



db_connection.end();

