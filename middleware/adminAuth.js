exports.isAdmin = (req,res,next)=>{
    try {
        if(req.session.admin){
            next()
        }else{
            res.redirect('/admin/login')
        }
    } catch (error) {
        console.log(error)
    }
}

exports.isLogout = (req,res,next)=>{
        if(req.session.admin){
            res.redirect('/admin/dashboard')
        }else{
            next()
        }

}