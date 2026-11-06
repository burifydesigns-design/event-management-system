const db = require('../lib/db');
const TABLE = 'orders';

module.exports = {
  async findOne(opts) {
    return db.findOne(TABLE, opts);
  },
  async findById(id, opts) {
    return db.findById(TABLE, id, opts);
  },
  async find(opts) {
    return db.find(TABLE, opts);
  },
  async create(data) {
    return db.create(TABLE, data);
  },
  async findByIdAndUpdate(id, data) {
    return db.updateById(TABLE, id, data);
  },
  async countDocuments(filter) {
    return db.count(TABLE, filter);
  },
};
