-- creating schema

local restaurantSchema = {
    identifier = { type = "String", required = true, unique = true },
    name = { type = "String", required = true },
    coords = {
        x = { type = "Number", required = true },
        y = { type = "Number", required = true },
        z = { type = "Number", required = true },
    },
    items = {
        type = "Array",
        schema = {
            {
                name = { type = "String", required = true },
                price = { type = "Number", required = true },
                metadata = { type = "Object", required = false },
            }
        },
        required = false,
        default = {}
    },
    zones = {
        type = "Object",
        required = true
    }
}

CreateThread(function()
    exports.mongodb:createSchema('restaurants', restaurantSchema)
end)

--example repository

Repository = {}
convertVectorsToTable = function(tbl)
    if type(tbl) ~= "table" then return tbl end
    local newTbl = {}
    for k, v in pairs(tbl) do
        if type(v) == "vector3" then
            newTbl[k] = { x = v.x, y = v.y, z = v.z }
        elseif type(v) == "vector2" then
            newTbl[k] = { x = v.x, y = v.y }
        elseif type(v) == "table" then
            newTbl[k] = convertVectorsToTable(v)
        else
            newTbl[k] = v
        end
    end
    return newTbl
end

Repository.addRestaurant = function(restaurant)
    restaurant = convertVectorsToTable(restaurant)
    local response = exports.mongodb:insertOne({
        collection = 'restaurants',
        document = restaurant
    })
    return response
end

Repository.updateRestaurant = function(restaurant)
    restaurant = convertVectorsToTable(restaurant)
    return exports.mongodb:updateOne({
        collection = 'restaurants',
        query = { _id = restaurant._id },
        update = { ['$set'] = restaurant }
    })
end

Repository.getRestaurants = function()
    local response = exports.mongodb:find({
        collection = 'restaurants',
        query = {}
    })
    return response and response or {}
end

Repository.addItemToRestaurant = function(restaurantId, item)
    return exports.mongodb:updateOne({
        collection = 'restaurants',
        query = { identifier = restaurantId },
        update = { ['$push'] = { items = item } }
    })
end

Repository.removeItemFromRestaurant = function(restaurantId, itemId)
    return exports.mongodb:updateOne({
        collection = 'restaurants',
        query = { identifier = restaurantId },
        update = { ['$pull'] = { items = { id = itemId } } }
    })
end
