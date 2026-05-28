function getCurrentRider(req, res) {
  res.json({ rider: req.rider });
}

module.exports = { getCurrentRider };
