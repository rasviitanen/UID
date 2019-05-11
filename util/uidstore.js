import UIDDatabase from "./uiddatabase.js"
import UIDCommunication from "./uidcommunication.js"
import "./vuex.js"
Vue.use(Vuex)

// Load instantly
var UIDCom = new UIDCommunication().connect()

var helpers = {
    fetch: async function(key) {
        var items = await UIDDatabase.getData(key).then((doc) => doc.data, (err) => [])

        items.forEach(function (item, index) {
            item.id = index
        })

        helpers.uid = items.length
        return items

    },
    save: function (pair) {
        UIDDatabase.submitKVPair(pair.key, pair.value)
    }
}

const UIDStore = new Vuex.Store({
  state: {/*Add fields here through the addField action*/},
  mutations: {
    update: (state, pair) => {
        console.log(JSON.stringify(pair.value))
        console.log(JSON.stringify(state[pair.key]))

        if (JSON.stringify(pair.value) != JSON.stringify(state[pair.key])) {
            state[pair.key] = pair.value
            UIDDatabase.submitKVPair(pair.key, pair.value)
            helpers.save(pair)
        }
    }
  },
  actions: {
    fetch: async (context, key) => {
        // Get the data from UID Pouch
        var result = await helpers.fetch(key)
        // Update the state
        context.commit("update", {key: key, value: result})
    },
    save: async (context, key, value) => {
        // Get the data from UID Pouch
        helpers.save({key: key, value: context.state[key]})
    },
    addField: (context, field) => {
        var state = {
            ...context.state
        }
        state[field] = []
        UIDStore.replaceState(state)
    },
    mutation: (context, data) => {
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