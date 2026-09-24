using {com.portfolio.purchase as db} from '../db/schema';

@path: '/purchase'
service PurchaseRequestService {
    entity Departments          as projection on db.Departments;

    entity PurchaseRequests     as projection on db.PurchaseRequests
        actions {

            action submit()  returns PurchaseRequests;

            action approve() returns PurchaseRequests;

            action reject()  returns PurchaseRequests;

        };

    entity PurchaseRequestItems as projection on db.PurchaseRequestItems;
}
