const renderMessages = (req, res) => {
    const user = req.user;
    res.json({ 
        success: true,
        title: 'Messages', 
        user: user
    });
};

module.exports = { renderMessages };

