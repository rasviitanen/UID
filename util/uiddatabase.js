'use strict';

import './pouchdb.js';

const UIDDatabase = (function() {
    var db = new PouchDB('UID');
    var remoteCouch = false;
    
    function submitData(data) {
        console.log("[UID Database] Submitted data to database", data);
        return db.put(data);
    }

    function submitKVPair(key, value) {
        return db.get(key).then((doc) => {
            console.log("[UID Database] Submitted data to database", value);
            return db.put({"_id": key, "_rev": doc._rev, "data": value});
        }, (err) => {
            return db.put({"_id": key, "data": value});
        });          
    }

    function getData(data) {
        console.log("[UID Database] Getting data from database", data);
        return db.get(data);
    }

    function getDataCallback(data, callback) {
        console.log("[UID Database] Getting data from database", data);
        return db.get(data, callback);
    }

    function submitDID(did) {
        console.log("[UID Database] Submitted DID to database", did.did);
        return db.put(did.did);
    }

    function bulkSubmit(didArray) {
        console.log("[UID Database] Submitted DIDs to database as bulk", didArray);
        return db.bulkDocs(didArray);
    }

    function findDID(query) {
        console.log("[UID Database] got query ->", query);
        return db.createIndex({
            index: {fields: query.fields}
        }).then(function () {
            return db.find({
                selector: query.selector,
            });
        });   
    }
    
    function getDID(id) {
        return db.get(id);
    }
    
    function removeDID(did) {
        return db.remove(did);
    }
    
    function getDIDS() {
        return db.allDocs({include_docs: true, descending: true});
    }
    
    return {
        db: (db),
        submitData: (submitData),
        getData: (getData),
        getDataCallback: (getDataCallback),
        submitKVPair: (submitKVPair),
        submitDID: (submitDID),
        bulkSubmit: (bulkSubmit),
        findDID: (findDID),
        getDID: (getDID),
        getDIDS: (getDIDS),
    };
})();

export default UIDDatabase;