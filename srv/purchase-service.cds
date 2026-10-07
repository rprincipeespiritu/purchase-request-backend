using { com.portfolio.purchase as db } from '../db/schema';

@path: '/purchase'
service PurchaseRequestService {

    @restrict: [
        {
            grant: 'CREATE',
            to: 'Requester'
        },
        {
            grant: ['READ', 'UPDATE'],
            to: 'Requester',
            where: 'requester.username = $user'
        },
        {
            grant: 'READ',
            to: 'Approver'
        }
    ]
    entity PurchaseRequests
        as projection on db.PurchaseRequests
        actions {

            @requires: 'Requester'
            action submit()  returns PurchaseRequests;

            @requires: 'Approver'
            action approve() returns PurchaseRequests;

            @requires: 'Approver'
            action reject()  returns PurchaseRequests;
        };

    entity PurchaseRequestItems
        as projection on db.PurchaseRequestItems;

    entity Departments
        as projection on db.Departments;
}