const express = require('express')
// const handlebars = require('express-handlebars')
const mongoose = require('mongoose')
const cheerio = require('cheerio')
const axios = require('axios')

const Article = require('./models/Article')
const Note = require('./models/Note')


const PORT = process.env.PORT || 8080
const app = express()

mongoose.connect("mongodb://localhost/newscrape", { useNewUrlParser: true })

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.get('/', async (req, res) => {
    try {
        const body = await axios.get("http://www.echojs.com/")
        const $ = cheerio.load(body.data)
        const currentArticles = await Article.find({})
        const scrapedArticles = []

        $("article h2").each(function() {
            const result = {}

            result.title = $(this).children("a").text()
            result.link = $(this).children("a").attr("href")

            scrapedArticles.push(result)
        })

        for (let thisArticle of currentArticles) {
            let found = false
            let index

            for (let i = 0; i < scrapedArticles.length; i++) {
                if (thisArticle.title === scrapedArticles[i].title) {
                    found = true
                    index = i
                    break
                }
            }
            
            if (found) {
                scrapedArticles.splice(index, 1)
            } else {
                await Note.deleteMany({ _id: { $in: thisArticle.notes } })
                await Article.deleteOne({ _id: thisArticle._id })
            }
        }

        if (scrapedArticles.length > 0) {
            await Article.collection.insert(scrapedArticles)
        }

        res.status(200).json({ 200: await Article.find({}) })
    } catch(error) {
        throw new Error(error)
    }
})

app.post('/add/:articleId', async (req, res) => {
    try {
        const { title, body } = req.body
        const foundArticle = await Article.findOne({ _id: req.params.articleId })

        if (!foundArticle) {
            return res.status(400).json({ 400: 'No article was found' })
        }

        const newNote = await Note.create({ title, body })

        foundArticle.notes.push(newNote._id)
        await foundArticle.save()
        
        res.json({ 200: newNote })
    } catch(error) {
        throw new Error(error)
    }
})

app.get('/remove/:articleId', async (req, res) => {
    try {
        const foundArticle = await Article.findOne({ _id: req.params.articleId })

        if (!foundArticle) {
            return res.status(400).json({ 400: 'No article was found' })
        }

        await Note.deleteMany({ _id: { $in: foundArticle.notes } })
        await Article.deleteOne({ _id: foundArticle._id })

        res.status(200).json({ 200: 'Article has been removed' })
    } catch (error) {
        throw new Error(error)
    }
})

app.get('/remove/:articleId/:noteId', async (req, res) => {
    try {
        const foundArticle = await Article.findOne({ _id: req.params.articleId })

        if (!foundArticle) {
            return res.status(400).json({ 400: 'No article was found' })
        }

        const foundNote = await Note.findOne({ _id: req.params.noteId })

        if (!foundNote) {
            return res.status(400).json({ 400: 'No note was found' })
        }

        await foundNote.remove()

        foundArticle.notes = foundArticle.notes.filter(note => {
            return note != req.params.noteId
        })
        foundArticle.save()

        res.status(200).json({ 200: 'Note has been removed' })
    } catch(error) {
        throw new Error(error)
    }
})

app.get('/remove', async (req, res) => {
    try {
        await Article.deleteMany({})
        await Note.deleteMany({})

        res.status(200).json('Removed all documents')
    } catch(error) {
        throw new Error(error)
    }
})

app.listen(PORT, console.log(`Server started on port ${PORT}...`))