@path: '/user'
service UserService {

    @requires: 'authenticated-user'
    function getCurrentUser() returns {
        ID       : UUID;
        username : String;
        fullName : String;
        email    : String;
    }
}