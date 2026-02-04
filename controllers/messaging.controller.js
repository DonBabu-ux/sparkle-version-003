const renderMessages = (req, res) => {
    res.render('messages', { title: 'Messages', user: req.user });
};

module.exports = { renderMessages };
