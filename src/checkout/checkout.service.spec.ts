import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  let service: CheckoutService;

  /*
  let requestMock = {
    products: null,
    userId: null,
    orderId: null
  }

  
  let responseMock = {
    status: jest.fn((x) => x)
  }
*/
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckoutService],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /*
  describe("finalizeCheckout", () => {
    it("should return a status of 400", () => {
      service.finalizeCheckout(requestMock.products, requestMock.orderId, requestMock.userId);
      expect(responseMock.status).toHaveBeenCalledWith(400);
    })
  })
    */
});
