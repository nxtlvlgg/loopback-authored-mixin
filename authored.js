var async = require("async");
var loopback = require("loopback");
var packageJSON = require("./package");


var AUTHOR_DEFAULT_NAME = "author";


module.exports = function(Model, mixinOptions) {

    mixinOptions = mixinOptions || {};
    var authorName = mixinOptions.authorName || AUTHOR_DEFAULT_NAME;
    var foreignKeyName = authorName+"Id";
    var plural = Model.definition.settings.plural || Model.definition.name + "s";


    Model.dataSource.setMaxListeners(64);
    Model.dataSource.once("connected", function() {
        var ObjectId = Model.dataSource.connector.getDefaultIdType();
        var User = Model.app.models.user;

        // Add relation to slug model
        User.hasMany(Model, {as: plural, foreignKey: foreignKeyName});
        User.relations[plural].model = Model.definition.name;

        // Add properties and relations to slug model
        Model.defineProperty(foreignKeyName, { type: ObjectId });
        Model.belongsTo(User, {as: authorName, foreignKey: foreignKeyName});
        Model.relations[authorName].model = User.definition.name;
    });


    Model.beforeRemote("create", function(ctx, modelInstance, next) {
        saveAuthor(ctx, next);
    });


    function saveAuthor(ctx, finalCb) {

        // Look for userId
        if(!ctx.req || !ctx.req.accessToken) {
            return finalCb();
        }

        // Check if user is an admin
        var userId = ctx.req.accessToken.userId.toString();
        var User = Model.app.models.user;
        User.isInRoles(userId, ["$admin"], ctx.req,function(err, isInRoles) {
            if(err) return finalCb(err);

            // If the user isn't an admin, set the author to them automatically
            // Also add the add if it doesn't exist
            setAuthor(ctx.args.data, userId, isInRoles);

            return finalCb();
        });
    }

    function setAuthor(modelData, uid, roles) {

        // Handle arrays
        if(Array.isArray(modelData)) {
            for(var key in modelData) {
                var data = modelData[key];
                if(shouldOverride(data, roles)) {
                    data[foreignKeyName] = uid;
                }
            }

        // Handle single values
        } else {
            if(shouldOverride(modelData, roles)) {
                modelData[foreignKeyName] = uid;
            }
        }
    }

    function shouldOverride(data, roles) {
        return (roles.none || !data[foreignKeyName]);
    }
};


