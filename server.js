import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;

// 1. Middleware
app.use(express.json());

// Manual CORS Middleware
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}
	next();
});

app.use((req, res, next) => {
	console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
	next();
});

// 2. Serve static files (lesson images) from "images" folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/images', (req, res) => {
	res.status(404).send('Image not found. Please check the URL.');
});
// 3. MongoDB connection
const uri = process.env.MONGODB_URI || 'mongodb+srv://spacesaverofcomputer:spacesaverofcomputer@cluster0.rpgnn3v.mongodb.net';
const client = new MongoClient(uri);

let lessonsCollection;
let ordersCollection;

async function run() {
	try {
		await client.connect();
		console.log('Connected to MongoDB');

		const database = client.db('Webstore');
		lessonsCollection = database.collection('lessons');
		ordersCollection = database.collection('orders');

		app.get('/', (req, res) => {
			res.send(`
    <h1>Welcome to the Backend Server</h1>
    <ul>
      <li><a href="/orders">Go to Orders</a></li>
      <li><a href="/lessons">Go to Lessons</a></li>
    </ul>
  `);
		});

		// GET /lessons – return raw docs (with native _id)
		app.get('/lessons', async (req, res) => {
			try {
				const lessons = await lessonsCollection.find({}).toArray();
				res.json(lessons);
			} catch (error) {
				console.error('Error fetching lessons:', error);
				res.status(500).json({ error: 'Failed to fetch lessons' });
			}
		});

		// GET /orders – return all orders
		app.get('/orders', async (req, res) => {
			try {
				const orders = await ordersCollection.find({}).toArray();
				res.json(orders);
			} catch (error) {
				console.error('Error fetching orders:', error);
				res.status(500).json({ error: 'Failed to fetch orders' });
			}
		});

		// POST /orders – create a new order
		app.post('/orders', async (req, res) => {
			try {
				const order = req.body;
				// Insert the order into the orders collection
				const result = await ordersCollection.insertOne(order);
				res.status(201).json({ message: 'Order created', orderId: result.insertedId });
			} catch (error) {
				console.error('Order error:', error);
				res.status(500).json({ error: 'Internal server error' });
			}
		});

		// Update any attribute of the lesson collection
		app.put('/lessons', async (req, res) => {
			try {
				const lesson = req.body;
				delete lesson._id;

				const { id, ...updateFields } = lesson;

				const result = await lessonsCollection.updateOne(
					{ id: id }, // Match by numeric `id`
					{ $set: updateFields }
				);

				res.json({ message: 'Lesson updated successfully' });
			} catch (error) {
				console.error('Error updating lesson:', error);
				res.status(500).json({ error: 'Failed to update lesson' });
			}
		});

		// GET /search - Full text search on LessonName, Location, Price, Space
		app.get('/search', async (req, res) => {
			const query = (req.query.q || '').trim();

			try {
				// Return all lessons if search query is empty
				if (!query) {
					const lessons = await lessonsCollection.find({}).toArray();
					return res.json(lessons);
				}

				const regex = new RegExp(query, 'i'); // case-insensitive regex

				const results = await lessonsCollection
					.find({
						$or: [
							{ LessonName: regex },
							{ Location: regex },
							{
								$expr: {
									$regexMatch: {
										input: { $toString: '$Price' },
										regex: query,
										options: 'i',
									},
								},
							},
							{
								$expr: {
									$regexMatch: {
										input: { $toString: '$Space' },
										regex: query,
										options: 'i',
									},
								},
							},
						],
					})
					.toArray();

				res.json(results);
			} catch (err) {
				console.error('Search error:', err);
				res.status(500).json({ error: 'Search failed.' });
			}
		});

		// Start the server
		app.listen(port, () => {
			console.log(`Server is running on port ${port}`);
		});
	} catch (error) {
		console.error('Failed to connect to MongoDB:', error);
	}
}

run().catch(console.dir);
