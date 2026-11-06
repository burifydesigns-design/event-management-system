const db = require('../lib/db');
const TABLE = 'registrations';

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
  async findOneAndUpdate(filter, data) {
    return db.updateOne(TABLE, filter, data);
  },
  async updateOne(filter, data) {
    return db.updateOne(TABLE, filter, data);
  },
  async countDocuments(filter) {
    return db.count(TABLE, filter);
  },
  async distinct(field, filter) {
    return db.distinct(TABLE, field, filter);
  },
  async removeById(id) {
    return db.removeById(TABLE, id);
  },
};
