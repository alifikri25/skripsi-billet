// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library PriceLib {
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Hitung harga maksimum yang diizinkan untuk resale.
    /// @param originalPrice Harga tiket saat primary sale (dalam wei).
    /// @param ceilingBps Persentase batas harga dalam basis points (misal 11000 = 110%).
    /// @return maxPrice Harga tertinggi yang boleh di-listing ulang.
    function maxResalePrice(uint256 originalPrice, uint256 ceilingBps)
        internal
        pure
        returns (uint256)
    {
        return (originalPrice * ceilingBps) / BPS_DENOMINATOR;
    }
}
