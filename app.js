// Lab Computer Issue Reporting System
// Students report broken computers, technicians update the status

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const conn = require('./conn.js');

const app = express();

// settings
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'my secret key',
  resave: false,
  saveUninitialized: false
}));


// ------- STATUS FUNCTION----------

function countReports(reports) {
  let total = reports.length;
  let pending = 0;
  let progress = 0;
  let done = 0;

  for (let i = 0; i < reports.length; i++) {
    if (reports[i].status == 'Pending') {
      pending = pending + 1;
    } else if (reports[i].status == 'In Progress') {
      progress = progress + 1;
    } else if (reports[i].status == 'Done') {
      done = done + 1;
    }
  }

  return { total: total, pending: pending, progress: progress, done: done };
}


// --------- ROLE --------------

app.get('/', function (req, res) {
  res.render('role');
});

app.get('/role', function (req, res) {
  res.render('role');
});


// ---------- STUDENT ----------

// show the student login page
app.get('/student', function (req, res) {
  let message = '';
  if (req.query.registered) {
    message = 'Account created! You can sign in now.';
  }
  res.render('student', { error: '', message: message });
});

// student login form
app.post('/student', function (req, res) {
  const studentid = req.body.studentid;
  const password = req.body.password;

  const sql = 'SELECT * FROM students WHERE studentid = ?';

  conn.query(sql, [studentid], function (err, results) {
    if (err) {
      console.log(err);
      return res.status(500).send('Database error.');
    }

    // no student found
    if (results.length == 0) {
      return res.render('student', {
        error: 'Wrong student ID or password.',
        message: ''
      });
    }

    const student = results[0];

    // pw hash
    if (!bcrypt.compareSync(password, student.password)) {
      return res.render('student', {
        error: 'Wrong student ID or password.',
        message: ''
      });
    }

    // save studen session
    req.session.student = {
      studentid: student.studentid,
      name: student.name,
      email: student.email
    };

    res.redirect('/student_home');
  });
});

//---------- REGISTER -------------
app.get('/register', function (req, res) {
  res.render('register', { error: '' });
});

// register form
app.post('/register', function (req, res) {
  const studentid = req.body.studentid;
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const confirmpass = req.body.confirmPassword;

  // check if all boxes are filled
  if (!studentid || !name || !email || !password || !confirmpass) {
    return res.render('register', { error: 'Please fill in all the boxes.' });
  }


  if (password != confirmpass) {
    return res.render('register', { error: 'Passwords do not match.' });
  }


  const sql = 'SELECT studentid FROM students WHERE studentid = ?';

  conn.query(sql, [studentid], function (err, results) {
    if (err) {
      console.log(err);
      return res.status(500).send('Database error.');
    }

    if (results.length > 0) {
      return res.render('register', {
        error: 'That student ID is already registered.'
      });
    }

    // pw hash
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = 'INSERT INTO students (studentid, name, email, password) VALUES (?, ?, ?, ?)';
    const values = [studentid, name, email, hashedPassword];

    conn.query(sql, values, function (err) {
      if (err) {
        console.log(err);
        return res.status(500).send('Could not register student.');
      }

      res.redirect('/student?registered=yes');
    });
  });
});

// ------ STUDENT HOME PAGE --------------
app.get('/student_home', function (req, res) {
  // must be logged in
  if (!req.session.student) {
    return res.redirect('/student');
  }

  const sql = 'SELECT * FROM reports WHERE student_id = ? ORDER BY date_reported DESC';

  conn.query(sql, [req.session.student.studentid], function (err, results) {
    if (err) {
      console.log(err);
      results = [];
    }

    let message = '';
    let error = '';

    if (req.query.submitted) {
      message = 'Report submitted!';
    }
    if (req.query.error) {
      error = 'Please fill in all the boxes.';
    }

    res.render('student_home', {
      student: req.session.student,
      reports: results,
      counts: countReports(results),
      message: message,
      error: error
    });
  });
});

// submit report
app.post('/report', function (req, res) {
  if (!req.session.student) {
    return res.redirect('/student');
  }

  const labroom = req.body.labRoom;
  const computerno = req.body.computerNo;
  const issuetype = req.body.issueType;
  const description = req.body.description;

  // check if all boxes are filled
  if (!labroom || !computerno || !issuetype || !description) {
    return res.redirect('/student_home?error=yes');
  }

  const sql = 'INSERT INTO reports (student_id, student_name, lab_room, computer_no, issue_type, description) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [
    req.session.student.studentid,
    req.session.student.name,
    labroom,
    computerno,
    issuetype,
    description
  ];

  conn.query(sql, values, function (err) {
    if (err) {
      console.log(err);
      return res.redirect('/student_home?error=yes');
    }

    res.redirect('/student_home?submitted=yes');
  });
});

// delete avail only if status pending
app.post('/report/delete/:id', function (req, res) {
  if (!req.session.student) {
    return res.redirect('/student');
  }

  const sql = 'DELETE FROM reports WHERE id = ? AND student_id = ? AND status = ?';
  const values = [req.params.id, req.session.student.studentid, 'Pending'];

  conn.query(sql, values, function (err) {
    if (err) {
      console.log(err);
    }

    res.redirect('/student_home?deleted=yes');
  });
});

// student logout
app.get('/logout', function (req, res) {
  req.session.destroy();
  res.redirect('/role');
});


// ---------- TECHNICIAN ----------

// tech register
app.get('/technician', function (req, res) {
  let message = '';
  if (req.query.registered) {
    message = 'Account created! You can sign in now.';
  }
  res.render('technician', { error: '', message: message });
});

// tech log in 
app.post('/technician', function (req, res) {
  const badgeid = req.body.badgeid;
  const password = req.body.password;

  const sql = 'SELECT * FROM technician WHERE badgeid = ?';

  conn.query(sql, [badgeid], function (err, results) {
    if (err) {
      console.log(err);
      return res.status(500).send('Database error.');
    }

    if (results.length == 0) {
      return res.render('technician', {
        error: 'Wrong Badge ID or password.',
        message: ''
      });
    }

    const technician = results[0];

    if (!bcrypt.compareSync(password, technician.password)) {
      return res.render('technician', {
        error: 'Wrong Badge ID or password.',
        message: ''
      });
    }

    // save technician session
    req.session.technician = {
      badgeid: technician.badgeid,
      name: technician.name,
      email: technician.email
    };

    res.redirect('/technician_home');
  });
});

// technician dashboard 
app.get('/technician_home', function (req, res) {
  if (!req.session.technician) {
    return res.redirect('/technician');
  }

  const sql = 'SELECT * FROM reports ORDER BY date_reported DESC';

  conn.query(sql, function (err, results) {
    if (err) {
      console.log(err);
      results = [];
    }

    let message = '';

    if (req.query.updated) {
      message = 'Report updated!';
    }
    if (req.query.locked) {
      message = 'That report is already Done, so it can no longer be changed.';
    }

    res.render('technician_home', {
      technician: req.session.technician,
      reports: results,
      counts: countReports(results),
      message: message
    });
  });
});

// technician saves changes to a report
app.post('/technician_update/:id', function (req, res) {
  if (!req.session.technician) {
    return res.redirect('/technician');
  }

  const id = req.params.id;
  const status = req.body.status;
  const note = req.body.note;

  // only these 3 statuses are allowed
  if (status != 'Pending' && status != 'In Progress' && status != 'Done') {
    return res.redirect('/technician_home');
  }

  // reports that are already Done cannot be changed anymore
  const sql = 'UPDATE reports SET status = ?, technician_note = ?, technician_name = ?, date_updated = NOW() WHERE id = ? AND status <> ?';
  const values = [status, note, req.session.technician.name, id, 'Done'];

  conn.query(sql, values, function (err, result) {
    if (err) {
      console.log(err);
      return res.redirect('/technician_home');
    }

    // nothing was updated, so the report was already Done
    if (result.affectedRows == 0) {
      return res.redirect('/technician_home?locked=yes');
    }

    res.redirect('/technician_home?updated=yes');
  });
});

// technician logout
app.get('/technician_logout', function (req, res) {
  req.session.destroy();
  res.redirect('/technician');
});


// start the server
app.listen(8000, function () {
  console.log('Server running at http://localhost:8000');
});