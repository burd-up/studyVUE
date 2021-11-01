<template>
    <div class="preloader" v-if="!completeStartRequest">
        <img src="./media/preloader.svg"/>
    </div>
    <div v-if="completeStartRequest" class="content">
        <div class="inputBlock">
            <div>
                <div>Search</div>
                <input
                        :title="'Enter name'"
                        class="input"
                        v-model="ticker"
                        @input="changeCurrentSearch"
                        @keydown.enter="add"
                        type="text"/>

                <div class="prompts"
                     v-if="prompts.length > 0"
                >
                    <div v-for="prom in prompts"
                         :key="prom"
                         class="prompt"
                         @click="selectPrompt(prom)"
                    >
                        {{prom}}
                    </div>
                </div>
                <div class="error" v-if="inputError">Такой тикер уже добавлен, либо его не существует</div>
            </div>
            <button class="inputButton"
                    @click="add"
            >add
            </button>
        </div>

        <div class="filterBlock">
            Filter:
            <input class="filterInput"
                   :title="'Filter of tickers'"
                   v-model="currentFilter"
            />
        </div>

        <div class="paginationBlock">
            <button @click="currentPage = --currentPage"
                    class="buttonInBlock paginationButtonBack"
                    v-if="currentPage>1"
            >назад</button>
            <div class="paginationCurrentPage">page: {{currentPage}}</div>
            <button @click="currentPage = ++currentPage"
                    class="buttonInBlock paginationButtonForward"
                    v-if="hasNextPage"
            >вперед</button>
        </div>

        <hr class="delimiter">
        <div class="wrapper">
            <div
                    @click="select(t)"
                    class="block"
                    :class="{
                        'blockActive': selectedTicker === t
                    }"
                    v-for="t in paginatedTickers"
                    :key="t.name"
            >
                <div class="title">{{t.name}} - USD</div>
                <div class="price">{{t.price}}</div>
                <button class="buttonInBlock" v-on:click.stop="handleDelete(t)">Delete</button>
            </div>
        </div>
        <hr class="delimiter" v-if="tickers.length > 0">
        <div
                class="graph"
                v-if="selectedTicker"
        >
            <div
                    v-for="(el, index) in normalizedGraph"
                    :key="index"
                    :style="{ height: `${el}%`}"
                    class="graphEll"
            ></div>
            <button
                    class="closeGraph"
                    @click="selectedTicker = null">x
            </button>
        </div>
    </div>
</template>

<script>
    // x 1. Одинаковый код в watch | Критичность: 3
    //2. При удалении остается подписка на загрузку | Критичность: 5
    //3. Количество запросов | Критичность: 4
    //4. Запросы напрямую внутри компонента | Критичность: 5
    //5. Обработка ошибок API | Критичность: 5
    // x 6. Наличие в состоянии Зависимых данных | Критичность: 5+
    //7. График плохо выглядит если много цен | Критичность: 2
    //8. localStorage и анонимные вкладки | Критичность: 3
    //9. Магические строки и числа | Критичность: 1
    export default {
        name: "App",
        data() {
            return {
                ticker: '',
                tickers: [
                    /*                    {name: 'DEMO1', price: '-'},*/
                ],
                selectedTicker: null,
                graph: [],
                allTickers: null,
                prompts: [],
                inputError: false,
                completeStartRequest: false,
                currentPage: 1,
                currentFilter: '',
                pageSize: 6
            }
        },
        async created() {
            const f = await fetch(`https://min-api.cryptocompare.com/data/all/coinlist?summary=true&api_key=f991decaba03005d86f948cb8373ffa679fb18fbb0a3053a212e16f1044b7a3b`)
            const data = await f.json()
            this.allTickers = data.Data
            this.completeStartRequest = true
            const tickersData = JSON.parse(localStorage.getItem('cryptonomicon-tickers'))
            //добавляем в data данные из строки запроса url
            const params = new URL(window.location).searchParams
            if(params.get('filter')){
                this.currentFilter = params.get('filter')
            }
            if(params.get('page')){
                this.currentPage = Number(params.get('page'))
            }
            //----------------------------------------------
            if(tickersData){
                this.tickers = tickersData
                this.tickers.forEach(el => {
                    this.priceRequest(el.name)
                })
            }
        },
        computed: {
            startIndex(){
                return this.currentPage * this.pageSize - this.pageSize
            },
            endIndex(){
                return this.currentPage * this.pageSize
            },
            filteredTickers(){
                return this.tickers.filter(el => el.name.includes(this.currentFilter.toUpperCase()))
            },
            paginatedTickers(){
            return this.filteredTickers.slice(this.startIndex, this.endIndex)
            },
            hasNextPage(){
                return this.filteredTickers.length > this.endIndex
            },
            normalizedGraph() {
                const maxValue = Math.max(...this.graph)
                const minValue = Math.min(...this.graph)
                return this.graph.map(price => {
                        return 5 + (((price - minValue) * 95) / ((maxValue - minValue) + 1))
                    }
                )
            },
            pageStateOptions() {
                return {
                    filter: this.currentFilter,
                    page: this.currentPage
                }
            }
        },
        methods: {
            priceRequest(query) {
                setInterval(async () => {
                    const f = await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${query}&tsyms=USD&api_key=f991decaba03005d86f948cb8373ffa679fb18fbb0a3053a212e16f1044b7a3b`)
                    const data = await f.json()
                    this.tickers.find(t => t.name === query.toUpperCase()).price = data.USD > 1 ? data.USD.toFixed(2) : data.USD.toPrecision(2)
                    //.toPrecision(2) возвращает число убирая в нем все после двух значащих символов после запятой
                    //.toFixed(2) возвращает число с двумя знаками после запятой
                    if (this.selectedTicker?.name === query.toUpperCase()) {
                        this.graph.push(data.USD)
                    }
                }, 3000)
            },
            add() {
                const newTicket = {name: this.ticker.toUpperCase(), price: '-'}
                if (!this.tickers.find(el => el.name === newTicket.name)) {
                    this.tickers = [...this.tickers, newTicket]
                    this.ticker = ''
                    this.inputError = false
                    this.prompts = []
                    this.priceRequest(newTicket.name)
                } else {
                    this.inputError = true
                }
            },
            handleDelete(currentElement) {
                this.tickers = this.tickers.filter(t => t !== currentElement)
                if(this.selectedTicker === currentElement){
                    this.selectedTicker = 0
                }
            },
            select(ticker) {
                this.selectedTicker = ticker;
            },
            selectPrompt(prop) {
                this.ticker = prop
                this.add()
            },

        },
        watch: {
            selectedTicker(previewSelected, newSelected){
              if (previewSelected !== newSelected){
                  this.graph = []
              }
            },
            tickers(){
                localStorage.setItem('cryptonomicon-tickers', JSON.stringify(this.tickers))
            },
            paginatedTickers() {
                if (this.paginatedTickers.length === 0 && this.currentPage > 1){
                    this.currentPage -= 1
                }
            },
            currentFilter: function () {
                this.currentPage = 1
            },
            ticker(){
                this.inputError = false
                this.prompts = []
                for (const el in this.allTickers) {
                    if (this.prompts.length < 4 && this.ticker !== '') {
                        this.allTickers[el].FullName.match(new RegExp(`${this.ticker}`, 'i'))
                            ? this.prompts = [...this.prompts, this.allTickers[el].Symbol] : null
                    }
                }
            },
            pageStateOptions: function () {
                window.history.pushState(null, document.title, `${window.location.pathname}?filter=${this.currentFilter}&page=${this.currentPage}`)
            }
        }
    };
</script>

<style>
    .filterBlock{
        margin: 0 auto;
    }

    .paginationBlock{
        width: 150px;
        margin: 10px auto;
        display: grid;
        grid-template-columns: 65px 80px 65px;
        align-items: center;
        justify-content: center;
    }

    .paginationButtonForward{
        grid-column: 3/4;
    }

    .paginationButtonBack{
        grid-column: 1/2;
    }

    .paginationCurrentPage{
        grid-column: 2/3;
        margin: 0 5px;
        justify-self: center;
    }

    .preloader {
        background-color: #42b983;
        height: 100vh;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .inputBlock {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: start;
    }

    .inputButton {
        height: 40px;
        border: none;
        width: 80px;
        border-radius: 5px;
        background-color: #42b983;
        margin: 10px 0;
        font-size: 20px;
        cursor: pointer;
    }

    .input {
        height: 40px;
        width: 220px;
        font-size: 22px;
        border-radius: 5px;
    }

    .prompts {
        display: flex;
        border-bottom: 1px solid gray;
        align-items: center;
    }

    .prompt {
        margin: 5px;
        padding: 0 5px;
        border-radius: 3px;
        background-color: #d2d2d2;
        font-size: 13px;
        cursor: pointer;
    }

    .error {
        color: red;
        margin: 5px 0;
    }

    .delimiter {
        width: 100%;
    }

    .content {
        margin: 0 auto;
        width: 1200px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: start;
    }

    .wrapper {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
    }

    .block {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        align-items: center;
        width: 180px;
        height: 160px;
        border-radius: 10px;
        margin: 10px;
        background-color: aliceblue;
        text-align: center;
    }

    .blockActive {
        border: #42b983 solid 3px;
    }

    .title {
        font-size: 20px;
    }

    .price {
        font-size: 35px;
    }

    .buttonInBlock {
        border: none;
        background-color: #42b983;
        border-radius: 5px;
        width: 90%;
        height: 25px;
        cursor: pointer;
    }

    .graph {
        position: relative;
        display: flex;
        justify-content: left;
        align-items: end;
        height: 300px;
        width: 100%;
        border-left: black solid 2px;
        border-bottom: black solid 2px;
    }

    .graphEll {
        width: 15px;
        margin: 2px;
        background-color: #42b983;
    }

    .closeGraph {
        position: absolute;
        top: 10px;
        right: 0;
    }
</style>
