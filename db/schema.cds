namespace com.portfolio.purchase;

using {
    cuid,
    managed
} from '@sap/cds/common';


entity Departments : cuid, managed {

    code        : String(10)  @mandatory;
    name        : String(100) @mandatory;
    description : String(255);

    users       : Association to many Users
                    on users.department = $self;
}


entity Users : cuid, managed {

    username    : String(50)  @mandatory;
    fullName    : String(120) @mandatory;
    email       : String(150) @mandatory;

    department  : Association to Departments;

    requests    : Association to many PurchaseRequests
                    on requests.requester = $self;
}


entity PurchaseRequests : cuid, managed {

    requestNumber : String(20)  @mandatory;
    requestDate   : Date;
    status        : RequestStatus @default: 'DRAFT';
    justification : String(500);
    totalAmount   : Decimal(15,2);

    requester     : Association to Users;
    department    : Association to Departments;

    items         : Composition of many PurchaseRequestItems
                      on items.request = $self;
}


entity PurchaseRequestItems : cuid, managed {

    product      : String(100) @mandatory;
    description  : String(255);

    quantity     : Integer;
    unitPrice    : Decimal(15,2);
    subtotal     : Decimal(15,2);

    request      : Association to PurchaseRequests;
}

type RequestStatus : String enum {
    DRAFT;
    SUBMITTED;
    APPROVED;
    REJECTED;
}