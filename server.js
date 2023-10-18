const fs = require("fs");
const bodyParser = require("body-parser");
const jsonServer = require("json-server");
const jwt = require("jsonwebtoken");

const server = jsonServer.create();

const router = jsonServer.router("./db.json");

const db = JSON.parse(fs.readFileSync("./db.json", "UTF-8"));

const middlewares = jsonServer.defaults();
const PORT = process.env.PORT || 3000;

server.use(middlewares);

server.use(jsonServer.defaults());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());

const SECRET_KEY = "123456789";
const expiresIn = "1h";

function createToken(payload) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET_KEY, (err, decode) =>
    decode !== undefined ? decode : err
  );
}

function isAuthenticated({ email, password }) {
  return (
    db.users.findIndex(
      (user) => user.email === email && user.password === password
    ) !== -1
  );
}

server.post("/register", (req, res) => {
  const { username, email, password } = req.body;

  exist_user = db.users.findIndex((x) => x.email === email);
  if (exist_user !== -1) {
    return res.status(401).json({
      status: 401,
      message: "Email already in use!",
    });
  }

  const new_user = {
    id: db.users.length + 1,
    username,
    email,
    password,
  };

  db.users.push(new_user);
  fs.writeFileSync("./db.json", JSON.stringify(db), () => {
    if (err) return console.log(err);
    console.log("writing to " + fileName);
  });
  res.status(201).json({
    status: 201,
    message: "Success",
    data: new_user,
  });
});

//login
server.post("/login", (req, res) => {
  // const {email, password} = req.body
  const email = req.body.email;
  const password = req.body.password;

  if (isAuthenticated({ email, password }) === false) {
    const status = 401;
    const message = "Incorrect email or password";
    res.status(status).json({ status, message });
    return;
  }
  const access_token = createToken({ email, password });
  res.status(200).json({
    status: 200,
    message: "Success",
    data: {
      access_token,
    },
  });
});

server.use("/auth", (req, res, next) => {
  if (
    req.headers.authorization == undefined ||
    req.headers.authorization.split(" ")[0] !== "Bearer"
  ) {
    const status = 401;
    const message = "Bad authorization header";
    res.status(status).json({ status, message });
    return;
  }
  try {
    let verifyTokenResult;
    verifyTokenResult = verifyToken(req.headers.authorization.split(" ")[1]);

    if (verifyTokenResult instanceof Error) {
      const status = 401;
      const message = "Error: access_token is not valid";
      res.status(status).json({ status, message });
      return;
    }
    next();
  } catch (err) {
    const status = 401;
    const message = "Token is our of date.";
    res.status(status).json({ status, message });
  }
});

//view all users
server.get("/auth/users", (req, res) => {
  res.status(200).json({
    status: 200,
    data: {
      users: db.users,
    },
  });
});

//view user by email
server.get("/auth/users/:email", (req, res) => {
  const email = req.params.email;

  const exist_email = db.users.findIndex((user) => user.email == email);
  const result = db.users.filter((user) => user.email == email);
  if (exist_email !== -1) {
    const status = 200;
    return res.status(status).json({ status, result });
  } else {
    return res.status(401).json({
      status: 401,
      message: "Email is not found!!",
    });
  }
});

server.get("/auth/orders", (req, res) => {
  res.status(200).json({
    status: 200,
    message: "Success",
    data: {
      order: db.orders,
    },
  });
});

server.get("/auth/orders/:id", (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = db.orders.find((order) => order.id === orderId);

  if (order) {
    return res.status(200).json({
      status: 200,
      data: {
        order: order,
      },
    });
  } else {
    return res.status(404).json({
      status: 404,
      message: "Order not found",
    });
  }
});


server.delete("/auth/orders/:id", (req, res) => {
  const orderId = parseInt(req.params.id);

  const orderIndex = db.orders.findIndex((order) => order.id === orderId);

  if (orderIndex !== -1) {
    db.orders.splice(orderIndex, 1);

    // Ghi lại cơ sở dữ liệu và kiểm tra lỗi ghi
    try {
      fs.writeFileSync("./db.json", JSON.stringify(db));
      res.status(204).json({
        status: 204,
        message: "Delete success"
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: "Error writing to the database",
        error: err.message
      });
    }
  } else {
    res.status(404).json({
      status: 404,
      message: "Order not found"
    });
  }
});




server.patch("/auth/orders/:id", (req, res) => {
  const orderId = parseInt(req.params.id);
  const updatedOrder = req.body; // Dữ liệu cập nhật đơn hàng

  const orderIndex = db.orders.findIndex((order) => order.id === orderId);

  if (orderIndex === -1) {
    return res.status(404).json({
      status: 404,
      message: "Order not found",
    });
  }

  // Cập nhật thông tin đơn hàng
  db.orders[orderIndex] = {
    ...db.orders[orderIndex],
    ...updatedOrder,
  };

  // Ghi lại cơ sở dữ liệu và kiểm tra lỗi ghi
  try {
    fs.writeFileSync("./db.json", JSON.stringify(db));
    res.status(200).json({
      status: 200,
      message: "Update success",
      data: db.orders[orderIndex],
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Error writing to the database",
      error: err.message,
    });
  }
});


server.post("/auth/orders", (req, res) => {
  const { bookId, customerName, quantity } = req.body;

  // Kiểm tra xem sách có sẵn trong danh sách không
  const bookIndex = db.books.findIndex((book) => book.id === bookId);

  if (bookIndex === -1) {
    return res.status(400).json({
      status: 400,
      message: "Book not found",
    });
  }

  const book = db.books[bookIndex];

  if (book.available) {
    const newOrder = {
      id: db.orders.length + 1,
      bookId,
      customerName,
      quantity,
      timestamp: new Date().getTime(),
    };
    db.orders.push(newOrder);


    try {
      fs.writeFileSync("./db.json", JSON.stringify(db));
      return res.status(201).json({
        status: 201,
        message: "Order success",
        data: newOrder,
      });
    } catch (err) {
      return res.status(500).json({
        status: 500,
        message: "Error writing to the database",
      });
    }
  } else {
    return res.status(400).json({
      status: 400,
      message: "Book is out of stock",
    });
  }
});




//DO SOMETHING
//END

server.use(router);

server.listen(PORT, () => {
  console.log("Run Auth API Server");
});