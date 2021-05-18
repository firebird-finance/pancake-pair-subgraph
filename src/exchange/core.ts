/* eslint-disable prefer-const */
import {BigDecimal} from "@graphprotocol/graph-ts";
import {
	Pair,
	Token,

} from "../../generated/schema";
import {Sync} from "../../generated/templates/Pair/Pair";
import {getBnbPriceInUSD, findBnbPerToken, getTrackedLiquidityUSD} from "./pricing";
import {convertTokenToDecimal, FACTORY_ADDRESS, ZERO_BD} from "./utils";

export function handleSync(event: Sync): void {
	let pair = Pair.load(event.address.toHex());
	let token0 = Token.load(pair.token0);
	let token1 = Token.load(pair.token1);

	pair.reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals);
	pair.reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals);

	if (pair.reserve1.notEqual(ZERO_BD)) pair.token0Price = pair.reserve0.div(pair.reserve1);
	else pair.token0Price = ZERO_BD;
	if (pair.reserve0.notEqual(ZERO_BD)) pair.token1Price = pair.reserve1.div(pair.reserve0);
	else pair.token1Price = ZERO_BD;

	let bnbPrice = getBnbPriceInUSD();

	let t0DerivedBNB = findBnbPerToken(token0 as Token);
	token0.derivedBNB = t0DerivedBNB;
	token0.derivedUSD = t0DerivedBNB.times(bnbPrice);

	let t1DerivedBNB = findBnbPerToken(token1 as Token);
	token1.derivedBNB = t1DerivedBNB;
	token1.derivedUSD = t1DerivedBNB.times(bnbPrice);

	// get tracked liquidity - will be 0 if neither is in whitelist
	let trackedLiquidityBNB: BigDecimal;
	if (bnbPrice.notEqual(ZERO_BD)) {
		trackedLiquidityBNB = getTrackedLiquidityUSD(
			bnbPrice,
			pair.reserve0,
			token0 as Token,
			pair.reserve1,
			token1 as Token
		).div(bnbPrice);
	} else {
		trackedLiquidityBNB = ZERO_BD;
	}

	// use derived amounts within pair
	pair.trackedReserveBNB = trackedLiquidityBNB;
	pair.reserveBNB = pair.reserve0
		.times(token0.derivedBNB as BigDecimal)
		.plus(pair.reserve1.times(token1.derivedBNB as BigDecimal));
	pair.reserveUSD = pair.reserveBNB.times(bnbPrice);
	// save entities
	pair.save();
	token0.save();
	token1.save();
}
