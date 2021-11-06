const API_KEY = 'f991decaba03005d86f948cb8373ffa679fb18fbb0a3053a212e16f1044b7a3b'
const AGGREGATE_INDEX = '5'
const INVALID_SUB = '500'

const tickersHandlers = new Map();
const socket = new WebSocket(`wss://streamer.cryptocompare.com/v2?api_key=${API_KEY}`)
const broadcastChannel = new BroadcastChannel('cryptonomicon')

sendToWebSocket({
    "action": "SubAdd",
    "subs": [`5~CCCAGG~BTC~USD`]
})

let priceBtcToUsd = 0

if (socket.readyState !== 0 || socket.readyState !== 1) {
    broadcastChannel.addEventListener('message', e => {
        console.log('bc')
        const handlers = tickersHandlers.get(e.data.currentTicker) ?? []
        handlers.forEach(fn => fn(e.data.price))
    })
}

if (socket.readyState === 0 || socket.readyState === 1) {
    socket.addEventListener('message', e => {

            const {TYPE: type, FROMSYMBOL: currentTicker, PRICE: price, PARAMETER: parameter} = JSON.parse(e.data)

            if (type === INVALID_SUB) {
                const invalidSub = parameter.split('~')[2]
                const handlers = tickersHandlers.get(invalidSub) ?? []
                handlers.forEach(fn => fn('invalidSub'))
                broadcastChannel.postMessage({currentTicker: invalidSub, price: 'invalidSub'})
            }

            if (type !== AGGREGATE_INDEX || !price) {
                return
            }

            if (currentTicker === "BTC" && price) {
                priceBtcToUsd = price
                const handlers = tickersHandlers.get(currentTicker) ?? []
                handlers.forEach(fn => fn(price))
                broadcastChannel.postMessage({currentTicker: currentTicker, price: price})
                return
            }

            broadcastChannel.postMessage({currentTicker: currentTicker, price: price*priceBtcToUsd})
            console.log('socket')
            const handlers = tickersHandlers.get(currentTicker) ?? []
            handlers.forEach(fn => fn(price*priceBtcToUsd))
        }
    )
}


function sendToWebSocket(message) {
    const stringifiedMessage = JSON.stringify(message)
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(stringifiedMessage)
        return
    }

    socket.addEventListener('open', () => {
        socket.send(stringifiedMessage)
    }, {once: true})
}

function subscribeToTickerOnWs(ticker) {
    //--------------------------------------------------------------------------------
    if(ticker === 'BTC'){
        return
    }
    //--------------------------------------------------------------------------------
    sendToWebSocket({
        "action": "SubAdd",
        "subs": [`5~CCCAGG~${ticker}~BTC`]
    })
}

function unSubscribeFromTickerOnWs(ticker) {
    //--------------------------------------------------------------------------------
    if(ticker === 'BTC'){
        return
    }
    //--------------------------------------------------------------------------------
    sendToWebSocket({
        "action": "SubRemove",
        "subs": [`5~CCCAGG~${ticker}~BTC`]
    })
}

export const subscribeToTicker = (ticker, cb) => {
    const subscribers = tickersHandlers.get(ticker) || []
    tickersHandlers.set(ticker, [...subscribers, cb])
    subscribeToTickerOnWs(ticker)
}

export const unsubscribeFromTicker = (ticker) => {
    tickersHandlers.delete(ticker)
    unSubscribeFromTickerOnWs(ticker)
}

export const requestForAllTickers = () =>
    fetch(`https://min-api.cryptocompare.com/data/all/coinlist?summary=true&api_key=${API_KEY}`)
        .then(response => response.json())
        .then(data => data.Data)


window.socket = socket