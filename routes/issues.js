var express = require('express');
var router = express.Router();

module.exports = function (pool) {
    
    router.get('/', function (req, res, next) {
        res.render('issues/list')
    })
    
    router.get('/add', function (req, res, next) {
        res.render('issues/project_detail_page_issues')
    })

    router.get('/list', function (req, res, next) {
        res.render('issues/list')
    })

    return router;
}