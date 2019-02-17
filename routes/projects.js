var express = require('express');
var router = express.Router();
var helpers = require('../helpers/util');

//var userChecker = require('../helper/userChecker')

module.exports = function (pool) {

    router.get('/', helpers.loggedIn, function (req, res, next) {
        //console.log(req.url);
        const url = req.query.page ? req.url : '/?page=1';
        const page = req.query.page || 1;
        const limit = 5;
        const offset = (page - 1) * limit
        let searching = false;
        let params = [];

        if (req.query.checkid && req.query.formid) {
            params.push(`projects.projectid = ${req.query.formid}`);
            searching = true;
        }

        if (req.query.checkname && req.query.formname) {
            params.push(`projects.projectname ilike '%${req.query.formname}%'`);
            searching = true;
        }

        if (req.query.checkmember && req.query.member) {
            params.push(`CONCAT(users.firstname,' ',users.lastname) = '${req.query.member}'`);
            searching = true;
        }

        // untuk menghitung jumlah data
        let sql = `select count(id) as total from (select distinct projects.projectid as id from projects
                LEFT JOIN members ON projects.projectid = members.projectid
                LEFT JOIN users ON members.userid = users.userid`

        if (searching) {
            sql += ` where ${params.join(' AND ')}`
        }

        sql += `) as project_member`;
        console.log('count query', sql);

        pool.query(sql, (err, data) => {
            const totalPages = data.rows[0].total;
            const pages = Math.ceil(totalPages / limit)

            //untuk menampilkan data dari project
            sql = `select distinct projects.projectid, projects.projectname from projects
                LEFT JOIN members ON projects.projectid = members.projectid
                LEFT JOIN users ON members.userid = users.userid`

            if (searching) {

                sql += ` where ${params.join(' AND ')}`
            }

            sql += ` ORDER BY projects.projectid LIMIT ${limit} OFFSET ${offset}`

            // untuk membatasi query members berdasarkan project yang akan diolah saja
            let subquery = `select distinct projects.projectid from projects LEFT JOIN members ON projects.projectid = members.projectid
            LEFT JOIN users ON members.userid = users.userid`
            if (searching) {
                subquery += ` where ${params.join(' AND ')}`
            }

            subquery += ` ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`
            //console.log("project list", subquery);

            // mendapatkan data member berdasarkan project
            let sqlMembers = `SELECT projects.projectid, CONCAT (users.firstname,' ',users.lastname) AS fullname
                    FROM members
                    INNER JOIN projects ON members.projectid = projects.projectid
                    INNER JOIN users ON users.userid = members.userid 
                    WHERE projects.projectid IN
                (${subquery})`;
            console.log("load members", sqlMembers);
            pool.query(sql, (err, projectData) => {
                pool.query(sqlMembers, (err, memberData) => {
                    projectData.rows.map(project => {
                        project.members = memberData.rows.filter(member => {
                            return member.projectid == project.projectid
                        }).map(item => item.fullname)
                    })
                    //console.log("data jadi", projectData.rows);
                    // ambil semua data dari users untuk select filter member
                    pool.query(`select CONCAT(firstname,' ',lastname) AS fullname from users`, (err, usersData) => {
                        // opsi checkbox untuk menampilkan colom di table
                        pool.query(`SELECT option -> 'option1' AS o1, option -> 'option2' AS o2, option -> 'option3' AS o3 FROM users where userid=${req.session.user}`, (err, data) => {
                            let columnOne = data.rows[0].o1;
                            let columnTwo = data.rows[0].o2;
                            let columnThree = data.rows[0].o3;

                            res.render('projects/list', {
                                data: projectData.rows,
                                users: usersData.rows,
                                pagination: {
                                    pages,
                                    page,
                                    totalPages,
                                    url
                                },
                                query: req.query,
                                columnOne,
                                columnTwo,
                                columnThree
                            })
                        })
                    })
                })
            })
        })
    });

    // ================================ OPTION CHECKLIST ================================ //

    router.post('/option', (req, res, next) => {
        let option1 = false;
        let option2 = false;
        let option3 = false;

        if (req.body.cid) {
            option1 = true;
        }
        if (req.body.cname) {
            option2 = true;
        }
        if (req.body.cmember) {
            option3 = true;
        }
        let sql = `UPDATE users SET option = option::jsonb || '{"option1" : ${option1}, "option2" : ${option2}, "option3" : ${option3}}' WHERE userid = ${req.session.user}`
        pool.query(sql, (err) => {
            //console.log(sql);
            if (err) {
                console.log(err);
            }
            res.redirect('/projects')
        })
    })

    // ================================ ADD ================================ //

    router.get('/add', function (req, res, next) {
        pool.query('select * from users ORDER BY userid', (err, data) => {
            if (err) return res.send(err)
            res.render('projects/add', { users: data.rows });
        })
    });

    router.post('/add', function (req, res, next) {
        //console.log(req.body);
        pool.query(`insert into projects (projectname) values ('${req.body.projectName}')`, (err) => {
            if (err) return res.send(err)
            if (req.body.users) {
                // select projectid from projects order by projectid desc limit 1

                pool.query(`select max(projectid) from projects`, (err, latestId) => {
                    if (err) return res.send(err)
                    let projectId = latestId.rows[0].max;
                    if (Array.isArray(req.body.users)) {
                        let values = [];
                        req.body.users.forEach((item) => {
                            values.push(`(${projectId}, ${item.split("#")[0]}, '${item.split("#")[1]}')`);
                        })
                        let sqlMembers = `insert into members (projectid, userid, role) values `
                        sqlMembers += values.join(', ')
                        console.log("query buat masukin members", sqlMembers);
                        pool.query(sqlMembers, (err) => {
                            if (err) return res.send(err)
                            res.redirect('/projects');
                        });
                    } else {
                        pool.query(`insert into members (projectid, userid, role) values (${projectId}, ${req.body.users.split("#")[0]}, '${req.body.users.split("#")[1]}')`, (err) => {
                            if (err) return res.send(err)
                            res.redirect('/projects');
                        });
                    }
                })

            } else {
                res.redirect('/projects');
            }
        });
    });

    //  ================================ EDIT ================================ //

    router.get('/edit/:id', function (req, res, next) {
        let id = req.params.id;
        pool.query(`SELECT * FROM projects where projectid = ${id}`, (err, projectData) => {
            if (err) return res.send(err)
            pool.query(`SELECT userid FROM members where projectid = ${id}`, (err, memberData) => {
                if (err) return res.send(err)
                pool.query('select userid, firstname, lastname, position from users ORDER BY userid', (err, userData) => {
                    if (err) return res.send(err)
                    res.render('projects/edit', {
                        project: projectData.rows[0],
                        members: memberData.rows.map(item => item.userid), //[1,3,5]
                        users: userData.rows
                    })
                })
            })
        });
    });

    router.post('/edit/:id', (req, res, next) => {

        let id = req.params.id;
        let projectname = req.body.projectName;

        pool.query(`UPDATE projects set projectname='${projectname}' where projectid = ${id}`, (err) => {
            if (err) return res.send(err)
            pool.query(`DELETE FROM members where projectid =${id}`, (err) => {
                if (err) return res.send(err)
                if (req.body.users) {
                    if (Array.isArray(req.body.users)) {
                        let values = [];
                        req.body.users.forEach((item) => {
                            values.push(`(${id}, ${item.split("#")[0]}, '${item.split("#")[1]}')`);
                        })
                        let sqlMembers = `insert into members (projectid, userid, role) values `
                        sqlMembers += values.join(', ')
                        //console.log("query buat masukin members", sqlMembers);
                        pool.query(sqlMembers, (err) => {
                            if (err) return res.send(err)
                            res.redirect('/projects');
                        });
                    } else {
                        pool.query(`insert into members (projectid, userid, role) values (${id}, ${req.body.users.split("#")[0]}, '${req.body.users.split("#")[1]}')`, (err) => {
                            if (err) return res.send(err)
                            res.redirect('/projects');
                        });
                    }
                } else {
                    res.redirect('/projects');
                }
            })
        })
    })

    // ================================ DELETE ================================ //
    router.get('/delete/:id', function (req, res, next) {
        let id = req.params.id;
        pool.query(`DELETE FROM members where projectid = ${id}`, (err) => {
            if (err) return res.send(err)
            pool.query(`DELETE FROM projects where projectid = ${id}`, (err) => {
                if (err) return res.send(err)
                console.log(`data berhasil di delete`);
                res.redirect('/projects');
            });
        });
    });
    // ================================ OVERVIEW ================================ //
    router.get('/:id/overview', function (req, res, next) {
        // pool.query(`SELECT CONCAT  (firstname, ' ', lastname) AS "fullname" FROM users;`)
        res.render('projects/project_detail_page_overview')
    })

    // ================================ MEMBER ================================ //
    router.get('/:id/member', helpers.loggedIn, function (req, res, next) {
        const url = req.query.page ? req.url : '/?page=1';
        const page = req.query.page || 1;
        const limit = 5;
        const offset = (page - 1) * limit
        let searching = false;
        let params = [];

        if (req.query.checkid && req.query.formid) {
            params.push(`projects.projectid = ${req.query.formid}`);
            searching = true;
        }

        if (req.query.checkname && req.query.formname) {
            params.push(`projects.projectname ilike '%${req.query.formname}%'`);
            searching = true;
        }

        if (req.query.checkmember && req.query.member) {
            params.push(`CONCAT(users.firstname,' ',users.lastname) = '${req.query.member}'`);
            searching = true;
        }

        // untuk menghitung jumlah data
        let sql = `select count(id) as total from (select distinct projects.projectid as id from projects
                LEFT JOIN members ON projects.projectid = members.projectid
                LEFT JOIN users ON members.userid = users.userid`

        if (searching) {
            sql += ` where ${params.join(' AND ')}`
        }

        sql += `) as project_member`;
        console.log('count query', sql);

        pool.query(sql, (err, data) => {
            let id = req.params.id;
            const totalPages = data.rows[0].total;
            const pages = Math.ceil(totalPages / limit)

            //untuk menampilkan data dari project
            sql = `select distinct projects.projectid, projects.projectname from projects
                LEFT JOIN members ON projects.projectid = members.projectid
                LEFT JOIN users ON members.userid = users.userid`

            if (searching) {

                sql += ` where ${params.join(' AND ')}`
            }

            sql += ` ORDER BY projects.projectid LIMIT ${limit} OFFSET ${offset}`

            // untuk membatasi query members berdasarkan project yang akan diolah saja
            let subquery = `select distinct projects.projectid from projects LEFT JOIN members ON projects.projectid = members.projectid
            LEFT JOIN users ON members.userid = users.userid`
            if (searching) {
                subquery += ` where ${params.join(' AND ')}`
            }

            subquery += ` ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`
            //console.log("project list", subquery);

            // mendapatkan data member berdasarkan project
            let sqlMembers = `SELECT members.id, members.role, users.firstname
            FROM members
            INNER JOIN projects ON members.projectid = projects.projectid
            INNER JOIN users ON members.userid = users.userid
            WHERE projects.projectid = 33`;
            console.log("load members", sqlMembers);

            pool.query(sqlMembers, (err, memberData) => {
console.log(memberData);


                res.render('projects/project_detail_page_members', {
                    data: memberData.rows,
                    // users: usersData.rows,
                    pagination: {
                        pages,
                        page,
                        totalPages,
                        url
                    },
                    query: req.query,
                    // columnOne,
                    // columnTwo,
                    // columnThree
                })
            })

        })
    })

    return router;
}