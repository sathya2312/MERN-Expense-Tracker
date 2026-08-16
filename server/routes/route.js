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

// -- Intelligent Planning APIs (ER-02) --
routes.route('/api/insights/budget-vs-actual')
    .get(controller.get_budget_vs_actual);

routes.route('/api/insights/health')
    .get(controller.get_health);

routes.route('/api/alerts')
    .get(controller.list_alerts);

routes.route('/api/alerts/:id')
    .patch(controller.update_alert_status);

routes.route('/api/forecast')
    .get(controller.get_forecast);

routes.route('/api/recommendations')
    .get(controller.get_recommendations);

module.exports = routes;
