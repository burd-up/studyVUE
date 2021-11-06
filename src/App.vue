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
            >назад
            </button>
            <div class="paginationCurrentPage">page: {{currentPage}}</div>
            <button @click="currentPage = ++currentPage"
                    class="buttonInBlock paginationButtonForward"
                    v-if="hasNextPage"
            >вперед
            </button>
        </div>

        <hr class="delimiter">
        <div class="wrapper">
            <div
                    @click="select(t)"
                    class="block"
                    :class="{
                        'block invalidTicker': t.price === 'invalidSub',
                        'blockActive': selectedTicker === t,
                    }"
                    v-for="t in paginatedTickers"
                    :key="t.name"
            >
                <div class="title">{{t.name}} - USD</div>
                <div class="price">{{formatPrice(t.price)}}</div>
                <button class="buttonInBlock" v-on:click.stop="handleDelete(t)">Delete</button>
            </div>
        </div>
        <hr class="delimiter" v-if="tickers.length > 0">
        <div
                class="graph"
                v-if="selectedTicker"
                ref="graph"
        >
            <div
                    v-for="(el, index) in normalizedGraph"
                    :key="index"
                    :style="{
                        height: `${el}%`,
                        margin: `${graphElementMargin}px`,
                        width: `${graphElementWidth}px`}"
                    class="graphEll"
                    ref="graphElement"
            ></div>
            <button
                    class="closeGraph"
                    @click="selectedTicker = null">X
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

    import {subscribeToTicker, unsubscribeFromTicker, requestForAllTickers} from "./api";

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
                pageSize: 6,
                maxGraphElement: 1,
                graphElementWidth: 25,
                graphElementMargin: 2,
            }
        },
        async created() {
            this.allTickers = await requestForAllTickers()
            this.completeStartRequest = true
            const tickersData = localStorage.getItem('cryptonomicon-tickers')
            if (tickersData) {
                this.tickers = JSON.parse(tickersData)
                this.tickers.forEach(ticker => {
                    subscribeToTicker(ticker.name, (newPrice) => this.updateTicker(ticker.name, newPrice))
                })
            }
            //добавляем в data данные из строки запроса url
            const params = new URL(window.location).searchParams
            if (params.get('filter')) {
                this.currentFilter = params.get('filter')
            }
            if (params.get('page')) {
                this.currentPage = Number(params.get('page'))
            }
            //----------------------------------------------
        },
        mounted() {
            window.addEventListener('resize', () => {
                this.calculateMaxGraphElements()
                this.cropGraphElements()
            })
        },
        beforeUnmount() {
            window.removeEventListener('resize', this.calculateMaxGraphElements)
        },
        computed: {
            startIndex() {
                return this.currentPage * this.pageSize - this.pageSize
            },
            endIndex() {
                return this.currentPage * this.pageSize
            },
            filteredTickers() {
                return this.tickers.filter(el => el.name.includes(this.currentFilter.toUpperCase()))
            },
            paginatedTickers() {
                return this.filteredTickers.slice(this.startIndex, this.endIndex)
            },
            hasNextPage() {
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
            calculateMaxGraphElements() {
                if (!this.$refs.graph) {
                    return
                }
                this.maxGraphElement = Math.floor(this.$refs.graph.clientWidth / (this.graphElementWidth+this.graphElementMargin))
            },
            updateTicker(tickerName, price) {
                this.tickers.filter(t => t.name === tickerName)
                    .forEach(t => {
                        t.price = price
                        if (t === this.selectedTicker) {
                            this.graph.push(price)
                            this.cropGraphElements(price)
                        }
                    })
                if (this.maxGraphElement === 1) {
                    this.calculateMaxGraphElements()
                }
            },
            cropGraphElements() {
                if (this.graph.length > this.maxGraphElement) {
                    this.graph = this.graph.slice((this.graph.length - this.maxGraphElement), this.graph.length)
                }
            },
            formatPrice(price) {
                if (Number.isFinite(price)) {
                    return price > 1 ? price.toFixed(2) : price.toPrecision(2)
                } else {
                    return '-'
                }
            },
            add() {
                const newTicker = {name: this.ticker.toUpperCase(), price: '-'}
                if (!this.tickers.find(el => el.name === newTicker.name)) {
                    this.tickers = [...this.tickers, newTicker]
                    this.ticker = ''
                    this.inputError = false
                    this.prompts = []
                    subscribeToTicker(newTicker.name, (newPrice) => this.updateTicker(newTicker.name, newPrice))
                } else {
                    this.inputError = true
                }
            },
            handleDelete(currentElement) {
                this.tickers = this.tickers.filter(t => t !== currentElement)
                if (this.selectedTicker === currentElement) {
                    this.selectedTicker = 0
                }
                unsubscribeFromTicker(currentElement.name)
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
            selectedTicker(previewSelected, newSelected) {
                if (previewSelected !== newSelected) {
                    this.graph = []
                }
            },
            tickers() {
                localStorage.setItem('cryptonomicon-tickers', JSON.stringify(this.tickers))
            },
            paginatedTickers() {
                if (this.paginatedTickers.length === 0 && this.currentPage > 1) {
                    this.currentPage -= 1
                }
            },
            currentFilter: function () {
                this.currentPage = 1
            },
            ticker() {
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

    .filterBlock {
        margin: 0 auto;
    }

    .paginationBlock {
        width: 150px;
        margin: 10px auto;
        display: grid;
        grid-template-columns: 65px 80px 65px;
        align-items: center;
        justify-content: center;
    }

    .paginationButtonForward {
        grid-column: 3/4;
    }

    .paginationButtonBack {
        grid-column: 1/2;
    }

    .paginationCurrentPage {
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
        border-radius: 20px;
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
        background-color: #f0f8ff;
        text-align: center;
    }

    .blockActive {
        border: #42b983 solid 3px;
    }

    .invalidTicker {
        background-color: #ffaeae;
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
        border-radius: 12.5px;
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
        background-color: #42b983;
    }

    .closeGraph {
        position: absolute;
        top: 10px;
        right: 0;
        border: gray 2px solid;
        border-radius: 50%;
        height: 30px;
        width: 30px;
    }

    @media (max-width: 1280px)and (min-width: 1024px) {
        .content {
            width: 1000px;
        }

        .block {
            flex: 0 1 31%;
        }
    }

    @media (max-width: 1023px)and (min-width: 768px) {
        .content {
            width: 750px;
        }

        .block {
            flex: 1 1 45%;
        }
    }

    @media (max-width: 767px)and (min-width: 600px) {
        .content {
            width: 600px;
        }

        .block {
            flex: 1 1 45%;
        }
    }

    @media (max-width: 599px)and (min-width: 480px) {
        .content {
            width: 480px;
        }

        .block {
            flex: 1 1 90%;
        }
    }

    @media (max-width: 479px) {
        .content {
            width: 320px;
        }

        .block {
            flex: 1 1 90%;
        }
    }
</style>
