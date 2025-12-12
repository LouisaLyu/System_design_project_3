// Below we will use the Express Router to define a series of API endpoints.
// Express will listen for API requests and respond accordingly
import express from 'express'
import pkg from 'express-openid-connect';
const { requiresAuth } = pkg;
const router = express.Router()

// Set this to match the model name in your Prisma schema
const model = 'JournalEntry'

// Prisma lets NodeJS communicate with MongoDB
// Let's import and initialize the Prisma client
// See also: https://www.prisma.io/docs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Connect to the database
prisma.$connect().then(() => {
    console.log('Prisma connected to MongoDB')
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err)
})

// ----- CREATE (POST) -----
// Create a new record for the configured model
// This is the 'C' of CRUD
// Only authenticated users can create entries
router.post('/data', requiresAuth(), async (req, res) => {
    try {
        // Get the authenticated user's ID from Auth0
        const userId = req.oidc.user.sub
        
        // Remove the id field from request body if it exists
        // MongoDB will auto-generate an ID for new records
        const { id, ...createData } = req.body

        const created = await prisma[model].create({
            data: {
                ...createData,
                userId: userId  // Add the user ID to the entry
            }
        })
        res.status(201).send(created)
    } catch (err) {
        console.error('POST /data error:', err)
        res.status(500).send({ error: 'Failed to create record', details: err.message || err })
    }
})


// ----- READ (GET) list ----- 
router.get('/data', async (req, res) => {
    try {
        // fetch first 100 records from the database with no filter
        const result = await prisma[model].findMany({
            take: 100
        })
        res.send(result)
    } catch (err) {
        console.error('GET /data error:', err)
        res.status(500).send({ error: 'Failed to fetch records', details: err.message || err })
    }
})



// ----- findMany() with search ------- 
// Accepts optional search parameter to filter by name field
// Also accepts userId query parameter to filter by user (when authenticated)
// See also: https://www.prisma.io/docs/orm/reference/prisma-client-reference#examples-7
router.get('/search', async (req, res) => {
    try {
        // get search terms from query string, default to empty string
        const searchTerms = req.query.terms || ''
        // get userId from query string if filtering by user
        const userId = req.query.userId || null
        
        // Build the where clause dynamically
        let whereClause = {};
        
        // If userId is provided, filter by that user
        if (userId) {
            whereClause.userId = userId;
        }
        
        // If search terms provided, search by title/body/topic
        if (searchTerms) {
            whereClause.OR = [
                { title: { contains: searchTerms, mode: 'insensitive' } },
                { body: { contains: searchTerms, mode: 'insensitive' } },
                { topic: { contains: searchTerms, mode: 'insensitive' } }
            ];
        }
        
        // fetch the records from the database
        const result = await prisma[model].findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 100
        })
        res.send(result)
    } catch (err) {
        console.error('GET /search error:', err)
        res.status(500).send({ error: 'Search failed', details: err.message || err })
    }
})


// ----- UPDATE (PUT) -----
// Listen for PUT requests
// respond by updating a particular record in the database
// This is the 'U' of CRUD
// After updating the database we send the updated record back to the frontend.
// Only the creator of the entry can edit it
router.put('/data/:id', requiresAuth(), async (req, res) => {
    try {
        const userId = req.oidc.user.sub
        
        // First, check if the entry exists and if the user is the creator
        const entry = await prisma[model].findUnique({
            where: { id: req.params.id }
        })
        
        if (!entry) {
            return res.status(404).send({ error: 'Entry not found' })
        }
        
        if (entry.userId !== userId) {
            return res.status(403).send({ error: 'You can only edit your own entries' })
        }
        
        // Remove the id and userId from the request body if they exist
        // The id should not be in the data payload for updates
        // The userId should not be changeable
        const { id, userId: userIdFromBody, ...updateData } = req.body

        // Prisma update returns the updated version by default
        const updated = await prisma[model].update({
            where: { id: req.params.id },
            data: updateData
        })
        res.send(updated)
    } catch (err) {
        console.error('PUT /data/:id error:', err)
        res.status(500).send({ error: 'Failed to update record', details: err.message || err })
    }
})

// ----- DELETE -----
// Listen for DELETE requests
// respond by deleting a particular record in the database
// This is the 'D' of CRUD
// Only the creator of the entry can delete it
router.delete('/data/:id', requiresAuth(), async (req, res) => {
    try {
        const userId = req.oidc.user.sub
        
        // First, check if the entry exists and if the user is the creator
        const entry = await prisma[model].findUnique({
            where: { id: req.params.id }
        })
        
        if (!entry) {
            return res.status(404).send({ error: 'Entry not found' })
        }
        
        if (entry.userId !== userId) {
            return res.status(403).send({ error: 'You can only delete your own entries' })
        }
        
        const result = await prisma[model].delete({
            where: { id: req.params.id }
        })
        res.send(result)
    } catch (err) {
        console.error('DELETE /data/:id error:', err)
        res.status(500).send({ error: 'Failed to delete record', details: err.message || err })
    }
})


// export the api routes for use elsewhere in our app 
// (e.g. in index.js )
export default router;

