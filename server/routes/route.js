const routes = require('express').Router();
const controller = require('../controller/controller');

routes.route('/api/categories')
    .post(controller.create_categories)
    .get(controller.get_categories);

routes.route('/api/transaction')
    .post(controller.create_transaction)
    .get(controller.get_transaction)
    .delete(controller.delete_transaction);

routes.route('/api/labels')
    .get(controller.get_labels);

// -- Budget routes (ER-01) --
routes.route('/api/budget')
    .post(controller.create_budget)
    .get(controller.get_budgets);

routes.route('/api/budget/:month')
    .get(controller.get_budget)
    .put(controller.update_budget)
    .delete(controller.delete_budget);

routes.route('/api/budget/:month/utilization')
    .get(controller.get_utilization);

module.exports = routes;
