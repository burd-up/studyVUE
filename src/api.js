const API_KEY = 'f991decaba03005d86f948cb8373ffa679fb18fbb0a3053a212e16f1044b7a3b'

const AGGREGATE_INDEX = '5';

const tickersHandlers = new Map();
const socket = new WebSocket(`wss://streamer.cryptocompare.com/v2?api_key=${API_KEY}`)
socket.addEventListener('message', e => {
    const {TYPE: type, FROMSYMBOL: currentTicker, PRICE: price} = JSON.parse(e.data)
    if(type !== AGGREGATE_INDEX || !price){
        return
    }
    const handlers = tickersHandlers.get(currentTicker) ?? []
    handlers.forEach(fn => fn(price))
})

function sendToWebSocket(message) {
    const stringifiedMessage = JSON.stringify(message)
    if(socket.readyState === WebSocket.OPEN){
        socket.send(stringifiedMessage)
        return
    }

    socket.addEventListener('open', () => {
        socket.send(stringifiedMessage)
    }, {once: true})
}

function subscribeToTickerOnWs(ticker) {
    sendToWebSocket({
        "action": "SubAdd",
        "subs": [`5~CCCAGG~${ticker}~USD`]
    })
}

function unSubscribeFromTickerOnWs(ticker) {
    sendToWebSocket({
        "action": "SubRemove",
        "subs": [`5~CCCAGG~${ticker}~USD`]
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
