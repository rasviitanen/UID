import UIDDatabase from "./uiddatabase.js"
import UIDCommunication from "./uidcommunication.js"
import "./vuex.js"
Vue.use(Vuex)

// Load instantly
var UIDCom = new UIDCommunication().connect()

var todoStorage = {
    fetch: async function(key) {
        var todos = await UIDDatabase.getData(key).then((doc) => doc.data, (err) => [])
        console.log("UNDEFINED?!", key);
        todos.forEach(function (todo, index) {
            todo.id = index
        })

        todoStorage.uid = todos.length
        return todos

    },
    save: function (pair) {
        UIDDatabase.submitKVPair(pair.key, pair.value)
    }
}

const UIDStore = new Vuex.Store({
  state: {
    todos: [],
  },
  getters: {
    todos: state => state.todos
  },
  mutations: {
    update: (state, pair) => {
        console.log(JSON.stringify(pair.value))
        console.log(JSON.stringify(state[pair.key]))

        if (JSON.stringify(pair.value) != JSON.stringify(state[pair.key])) {
            state[pair.key] = pair.value
            todoStorage.save(pair)
        }
    }
  },
  actions: {
    fetch: async (context, key) => {
        console.log("in fetch")
        // Get the data from UID Pouch
        var result = await todoStorage.fetch(key)
        // Update the state
        context.commit("update", {key: key, value: result})
    },
    save: async (context, key, value) => {
        console.log("in save")
        // Get the data from UID Pouch
        console.log("reeek", context.state[key]);

        todoStorage.save({key: key, value: context.state[key]})
    },
    mutation: (context, data) => {
        console.log("IN UID STORE", data)
        context.commit(data.mutation, data)
    },
    sync: (context, key) => {
        UIDCom.then((uid) => {
            uid.sendDirect(JSON.stringify({action: "mutation", mutation: "update", key: key, value: context.state[key]}))
        })
    }
  },
})

export default UIDStore;