var express = require('express');
var router = express.Router();
//var models = require('../models/index');


module.exports = function (pool) {

  // pool.query('select * from users', (err, res) => {
  //   console.log(res);
  // })

  // ========== LOGIN ==========

  router.get('/', function (req, res, next) {
    res.render('index', { loginMessage: req.flash('loginMessage') });
  });

  router.post('/', function (req, res, next) {
    let emails = req.body.email;
    let passwords = req.body.password;

    pool.query(`SELECT * FROM users where email='${emails}' and password='${passwords}'`, (err, data) => {
      if (data.rows.length == 0) {
        req.flash('loginMessage', 'Email atau Password Salah');
        res.redirect("/");
      } else {

        req.session.user = data.rows[0].userid;
        res.redirect("/projects");
      }
    })
  });

  // router.post('/', function (req, res, next) {
  //   //login check
  //   if (req.body.email == "rubi@gmail.com" && req.body.password == "1234") {
  //     req.session.user = req.body.email;
  //     res.redirect("/profil");
  //   } else {
  //     req.flash('loginMessage', 'Email atau Password Salah');
  //     res.redirect("/");
  //   }
  // });

  router.get('/logout', function (req, res, next) {
    req.session.destroy(() => {
      res.redirect('/')
    })
  })

  router.get('/project_detail_page_members', function (req, res, next) {
    res.render('project_detail_page_members');
  });

  router.get('/project_detail_page_overview', function (req, res, next) {
    res.render('project_detail_page_overview');
  });

  router.get('/project_detail_page_issues', function (req, res, next) {
    res.render('project_detail_page_issues');
  });
  return router;
};