import { Bot } from 'grammy'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import emoji from 'node-emoji'
import URL from 'url'
import cron from 'node-cron'
import axios from 'axios'


dotenv.config()

const dbConnnectionOptions = {
    maxPoolSize: 2,
    minPoolSize: 1,
    socketTimeoutMS: 100000

}

await mongoose.connect(process.env.MONGO_URI, dbConnnectionOptions)

let eventSchema = mongoose.Schema(
    {
        status: {
            type: String,
            required: true
        },
        time: {
            type: Date,
            required: true
        }
    }
)

let serviceSchema = mongoose.Schema(
    {
        url: {
            type: String,
            required: true
        },
        currentStatus: {
            type: String,
            required: true,
            enum: ['up', 'down'],
            default: 'down'
        },
        eventList: {
            type: [eventSchema],
            required: true,
            default: []
        },
        userIdList: {
            type: [String],
            required: true
        }
    },
    {
        timestamps: true
    }
)

let Service = mongoose.model('Service', serviceSchema)

let bot = new Bot(process.env.TELEGRAM_TOKEN)

bot.command('start', async (ctx) => {
    let welcomeMessage = 
    `Hello, Thanks for stopping by. This is a simple bot which can alert you when your service goes down (or up)
Why don't you try /help and see what the bot can do for you?
    `

    await ctx.reply(welcomeMessage)
})

bot.command('help', async (ctx) => {
    let helpMessage = 
    `
    /add <service url> : add a service for monitoring, please make sure, it does not require any authentication, is a http GET request.
Please do not forget to prefix with 'http://' or 'https://' which ever is appliable.
Example: /add https://google.com

/remove <service url> : remove a service already added for monitoring
Example: /remove https://google.com

/all : see all your monitored services
    `

    await ctx.reply(helpMessage)
})

bot.command('add', async (ctx) => {
    let userId = ctx.msg.chat.id
    let message = ctx.msg.text

    let tokens = message.split(' ')
    if (tokens.length < 2) {
        await ctx.reply(`No url is specified`)
        return
    }

    let url = tokens[1].trim().toLowerCase()

    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        url = 'http://' + url
    }
    if (!isValidURL(url)) {
        await ctx.reply(`URL is not valid`)
        return
    }

    let exists = await Service.findOne({ url: url })
    if (exists && exists.userIdList && exists.userIdList.includes(userId)) {
        await ctx.reply("Hmm..looks like this is already being monitored by you")
        return
    }

    if (exists) {
        await Service.updateOne({ url: url }, { $addToSet: { userIdList: userId } })
    }

    else {
        let newService = new Service({
            url: url,
            currentStatus: 'down',
            userIdList: [userId]
        })

        await newService.save()
    }

    
    await ctx.reply(`Your service is added to monitor, 
It will be pinged every 10 seconds, When there is a change in status, you will be notified`)

})

bot.command('remove', async (ctx) => {
    let userId = ctx.msg.chat.id
    let message = ctx.msg.text

    let tokens = message.split(' ')
    if (tokens.length < 2) {
        await ctx.reply(`No url is specified`)
        return
    }

    let url = tokens[1].trim().toLowerCase()

    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        url = 'http://' + url
    }

    console.log(url)

    let exists = await Service.findOne({ url: url })

    if (!exists || (exists.userIdList && !exists.userIdList.includes(userId))) {
        await ctx.reply(`Hmm...the specified service does not seem to be currently monitored`)
        return
    }

    await Service.updateOne({ url: url }, { $pull: { userIdList: userId }})

    await ctx.reply(`Your service is removed from the monitor, You will no longer recieve any updates for this service`)

})

bot.command('all', async (ctx) => {
    let userId = ctx.msg.chat.id
    let allServicesOfUser = await Service.find({ userIdList: userId }).exec()

    let messageToSend = ``
    for (let i = 0; i < allServicesOfUser.length; i++) {
        messageToSend += `${i + 1}. ${allServicesOfUser[i].url} \n`
    }
    if (messageToSend.length == 0) {
        await ctx.reply(`You have not added any services currently, why don't you try /help and see what the bot can do for you?`)
        return
    }

    await ctx.reply(messageToSend)
})

bot.catch(async (err) => {
    console.log(`random error: ${err}`)
    let ctx = err.ctx
    await ctx.reply(`We messed up this time!`)
})

bot.start()

async function isValidURL(urlString) {
    try {
        let u = new URL.URL(urlString)
        return true
    } catch (err) {
        return false
    }
}

async function alertM(service) {
    axios.get(service.url)
    .then(async (res) => {
        let status = 'up'
        if (service.currentStatus != status) {   
            let updateIfExists =  await Service.findOneAndUpdate({ userId: service.userId, url: service.url }, 
                { currentStatus: status, $push : { eventList: { status: status, time: new Date(Date.now()) } } })
            await sendMessagesBulk(service.userIdList, `Your service ${service.url} is now ${status}`)
        }
    })
    .catch(async (err) => {
        let status = 'down'
        if (service.currentStatus != status) {
            let updateIfExists =  await Service.findOneAndUpdate({ userId: service.userId, url: service.url }, 
                { currentStatus: status, $push : { eventList: { status: status, time: new Date(Date.now()) } } })
            await sendMessagesBulk(service.userIdList, `Your service ${service.url} is now ${status}`)
        }
    })
}


async function sendMessagesBulk(userIdList, message) {
    try {
        let sendMessagePromiseList = []
        for (let userId of userIdList) {
            sendMessagePromiseList.push(bot.api.sendMessage(userId, message))
        }
        await Promise.all(sendMessagePromiseList)
    } catch (err) {
        console.log(`could not send message, reason: ${err}`)
    }
}

cron.schedule('*/10 * * * * *', async () => {
    console.log('starting alerting service...')
    let allServices = await Service.find({}).exec()
    for (let service of allServices) {
        alertM(service)
    }

})





