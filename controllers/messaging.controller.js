const renderMessages = (req, res) => {
    const user = req.user || res.locals.user;
    res.render('messages', { 
        title: 'Messages', 
        user: user
    });
};

module.exports = { renderMessages };
