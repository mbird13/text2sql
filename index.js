import OpenAI from "openai";
import mysql from "mysql2/promise";

process.loadEnvFile();

const client = new OpenAI();
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
        
        const userValues = [
                ['alice', 'alice@gmail.com'],
                ['bob', 'bob@gmail.com'],
                ['charlie', 'charlie@gmail.com'],
                ['diana', 'diana@gmail.com'],
                ['eve', 'eve@gmail.com'],
                ['frank', 'frank@gmail.com'],
                ['grace', 'grace@gmail.com'],
                ['henry', 'henry@gmail.com'],
                ['irene', 'irene@gmail.com'],
                ['jack', 'jack@gmail.com']
            ];
        
        await db_connection.query(insert_sql('users', 'username, email'), [userValues]);

        const movieValues = [
            ['Inception', 'Sci-Fi', 2010],
            ['The Matrix', 'Sci-Fi', 1999],
            ['Interstellar', 'Sci-Fi', 2014],
            ['The Godfather', 'Crime', 1972],
            ['Pulp Fiction', 'Crime', 1994],
            ['The Dark Knight', 'Action', 2008],
            ['Forrest Gump', 'Drama', 1994],
            ['Fight Club', 'Drama', 1999],
            ['Gladiator', 'Action', 2000],
            ['Titanic', 'Romance', 1997]
        ];

        await db_connection.query(insert_sql('movies', 'title, genre, release_year'), [movieValues]);

        const reviewValues = [
            [1, 1, 5, 'Mind-blowing movie'],
            [2, 2, 5, 'A classic'],
            [3, 3, 4, 'Visually stunning'],
            [4, 4, 5, 'Masterpiece'],
            [5, 5, 4, 'Very entertaining'],
            [6, 6, 5, 'Best Batman movie'],
            [7, 7, 4, 'Heartwarming'],
            [8, 8, 4, 'Intense and unique'],
            [9, 9, 5, 'Epic action'],
            [10, 10, 3, 'Emotional but long']
        ];

        await db_connection.query(insert_sql('reviews', 'user_id, movie_id, rating, comment'), [reviewValues]);
        await db_connection.commit();
    } catch (err) {
        db_connection.rollback();
        console.log("Error in creating tables");
    }
}

async function run_query(sql) {
    return await db_connection.query(sql);
}
// const response = await client.responses.create({
//     model: "gpt-4o-nano",
//     input: "Write a one-sentence bedtime story about a unicorn."
// });

// console.log(response.output_text);

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

db_connection.end();

