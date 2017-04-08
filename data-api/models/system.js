var mongoose = require('mongoose');

var systemSchema = mongoose.Schema({

    system: {
        type: String,
        required: true
    },
    qa: {
        type: String,
        required: true
    },
    dev: {
        type: String,
        required: true
    },

    prod: {
        type: String,
        required: true
    },

});

var System = module.exports = mongoose.model('documents', systemSchema);

module.exports.getSystemById = function(name, callback) {
    System.find({
        system: name
    }, callback);
}
